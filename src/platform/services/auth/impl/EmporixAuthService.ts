import crypto from 'crypto';
import { inject } from 'inversify';
import {
  getPublicDefaultCurrency,
  getPublicDefaultLanguage,
  getPublicDefaultSite,
} from '@/lib/common/public-default-env';
import { resolveCountryForSite } from '@/lib/common/site-country';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixCustomerApi from '@/platform/integrations/emporix/customer/impl/EmporixCustomerApi';
import type { EmporixAddress } from '@/platform/integrations/emporix/model';
import type { EmporixCustomer } from '@/platform/integrations/emporix/model/customer';
import type { EmporixSessionContext } from '@/platform/integrations/emporix/model/session-context';
import type EmporixSessionContextApi from '@/platform/integrations/emporix/session/impl/EmporixSessionContextApi';
import { CART_CURRENCY_UPDATE_ERROR_CODE, CartCurrencyUpdateError } from '@/platform/services/cart/errors';
import type { Credentials, Registration, Session } from '@/platform/services/model/auth/auth';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Site } from '@/platform/services/model/common/site';
import type { CartMigrationService } from '../../cart/CartMigrationService';
import type { CartService } from '../../cart/CartService';
import type { LoggerService } from '../../logger/LoggerService';
import type EmporixAddressMapper from '../../model/common/impl/EmporixAddressMapper';
import type { SessionService } from '../../session';
import type { SiteService } from '../../site/SiteService';
import type { AuthService } from '../AuthService';

/**
 * Emporix implementation of the AuthService
 * Provides authentication functionality using the Emporix OAuth API
 */
@injectable('AuthService', 'Singleton')
export class EmporixAuthService implements AuthService {
  private readonly CART_VERIFICATION_ATTEMPTS = 10;
  private readonly CART_VERIFICATION_DELAY_MS = process.env.NODE_ENV === 'test' ? 1 : 300;
  private readonly CART_VERIFICATION_MAX_DELAY_MS = process.env.NODE_ENV === 'test' ? 5 : 1200;
  private readonly MERGE_CURRENCY_RETRY_ATTEMPTS = 2;
  private readonly MERGE_CURRENCY_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 1 : 400;
  private readonly CART_MERGE_STATUS = {
    MERGED: 'MERGED',
    FALLBACK: 'FALLBACK',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
  } as const;

  private readonly CART_MERGE_REASON = {
    ANONYMOUS_CART_NOT_ELIGIBLE: 'ANONYMOUS_CART_NOT_ELIGIBLE',
    TARGET_CART_UNAVAILABLE: 'TARGET_CART_UNAVAILABLE',
    UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
    CURRENCY_ALIGNMENT_FAILED: 'CURRENCY_ALIGNMENT_FAILED',
    MERGE_FAILED: 'MERGE_FAILED',
    TRANSITION_FAILED: 'TRANSITION_FAILED',
  } as const;

  /**
   * Constructor with dependency injection
   * @param oauthApi The Emporix OAuth API implementation
   * @param authMapper The auth mapper for converting between API and domain models
   */
  constructor(
    @inject('EmporixSessionContextApi')
    private readonly emporixSessionContextApi: EmporixSessionContextApi,
    @inject('EmporixCustomerApi')
    private readonly emporixCustomerApi: EmporixCustomerApi,
    @inject('EmporixAddressMapper')
    private readonly emporixAddressMapper: EmporixAddressMapper,
    @inject('CartMigrationService')
    private readonly cartMigrationService: CartMigrationService,
    @inject('SessionService')
    private readonly sessionService: SessionService,
    @inject('CartService')
    private readonly cartService: CartService,
    @inject('SiteService')
    private readonly siteService: SiteService,
    @inject('LoggerService')
    private readonly logger: LoggerService,
  ) {}

  async login(credentials: Credentials): Promise<Session> {
    const oldSession = await this.sessionService.getCurrent();
    // Capture the shopper's pre-login preferences so we can realign the
    // Emporix-migrated session context after login instead of silently
    // accepting the customer-preferred defaults Emporix returns (which would
    // yank the UI to the customer's home site/currency/language/country/region
    // on every login).
    const preferredSiteCode = oldSession?.siteCode || undefined;
    const preferredLanguage = oldSession?.language || undefined;
    const preferredCountry = oldSession?.country || undefined;
    const preferredRegion = oldSession?.region || undefined;
    const password = credentials.password || this.generateSsoPassword(credentials.username);

    // ── Phase 1: Capture anonymous cart ID before login ──
    // After emporixCustomerApi.login() the token switches from anonymous →
    // customer. Any subsequent getCart() call will discard the anonymous cart
    // via the safety check. We therefore snapshot the anonymous cart ID here.
    const anonymousCartId = oldSession?.cartId;

    const session = await this.emporixCustomerApi.login(credentials.username, password);
    if (!session) {
      throw new Error('Failed to get session context');
    }
    // Shopper's site choice wins when available; Emporix's migrated `session.siteCode`
    // is only used as a fallback. The subsequent combined-PATCH (see below) pushes
    // this back to the server so `getCanonicalSiteCode()` on the client sees the
    // aligned state and the post-login redirect becomes a no-op.
    const targetSiteCode = preferredSiteCode || session.siteCode || getPublicDefaultSite();
    const targetSite = await this.safeGetSite(targetSiteCode);
    const preferredLoginCurrency = this.resolveFinalLoginCurrency(targetSite, oldSession?.currency, session.currency);

    const settled = await this.settleLoginSessionContext({
      session,
      targetSite,
      preferredSiteCode,
      preferredLanguage,
      preferredCountry,
      preferredRegion,
      preferredLoginCurrency,
    });
    const binding = await this.bindCustomerCartAfterLogin(session, targetSiteCode, settled.finalCurrency);
    const merge = await this.resolveLoginCartMerge({
      anonymousCartId,
      session,
      targetSite,
      customerCartBinding: binding.customerCartBinding,
      verifiedCustomerCart: binding.verifiedCustomerCart,
      customerCartId: binding.customerCartId,
      finalCurrency: settled.finalCurrency,
    });
    const verifiedCustomerCart = await this.enforceLoginCartPreferences({
      session,
      verifiedCustomerCart: merge.verifiedCustomerCart,
      preferredLoginCurrency,
      finalCountry: settled.finalCountry,
    });

    if (verifiedCustomerCart && session.currency !== verifiedCustomerCart.currency) {
      session.currency = verifiedCustomerCart.currency;
    }

    return this.buildLoginResult(session, merge.customerCartId, merge.cartMergeStatus, merge.cartMergeReason);
  }

  private loginPreferenceDiffers(preferred: string | undefined, server: string | undefined): boolean {
    return preferred !== undefined && preferred !== server;
  }

  private applyPatchedLoginSession(
    session: EmporixSessionContext,
    patched: {
      siteCode?: string;
      currency?: string;
      country?: string;
      language?: string;
      region?: string;
    },
  ): void {
    if (patched.siteCode) session.siteCode = patched.siteCode;
    if (patched.currency) session.currency = patched.currency;
    if (patched.country) session.targetLocation = patched.country;
    if (patched.language) session.language = patched.language;
    if (patched.region) {
      session.context = { ...session.context, region: patched.region };
    }
  }

  private async settleLoginSessionContext(args: {
    session: EmporixSessionContext;
    targetSite: Site | null;
    preferredSiteCode?: string;
    preferredLanguage?: string;
    preferredCountry?: string;
    preferredRegion?: string;
    preferredLoginCurrency: string;
  }): Promise<{ finalCurrency: string; finalCountry: string | undefined }> {
    const {
      session,
      targetSite,
      preferredSiteCode,
      preferredLanguage,
      preferredCountry,
      preferredRegion,
      preferredLoginCurrency,
    } = args;
    const serverSiteCode = session.siteCode;
    const serverCurrency = session.currency;
    const serverLanguage = session.language;
    const serverCountry = session.targetLocation;
    const serverRegion = session.context?.['region'] as string | undefined;
    const finalLanguage = preferredLanguage ?? serverLanguage;
    const finalCountry =
      resolveCountryForSite(targetSite, preferredCountry ?? serverCountry) ?? preferredCountry ?? serverCountry;
    const finalRegion = preferredRegion ?? serverRegion;
    const needsPatch =
      this.loginPreferenceDiffers(preferredSiteCode, serverSiteCode) ||
      preferredLoginCurrency !== serverCurrency ||
      this.loginPreferenceDiffers(finalLanguage, serverLanguage) ||
      this.loginPreferenceDiffers(finalCountry, serverCountry) ||
      this.loginPreferenceDiffers(finalRegion, serverRegion);
    if (!needsPatch) {
      return { finalCurrency: preferredLoginCurrency, finalCountry };
    }
    try {
      const patched = await this.sessionService.updateContext(
        {
          siteCode: this.loginPreferenceDiffers(preferredSiteCode, serverSiteCode) ? preferredSiteCode : undefined,
          currency: preferredLoginCurrency === serverCurrency ? undefined : preferredLoginCurrency,
          language: this.loginPreferenceDiffers(finalLanguage, serverLanguage) ? finalLanguage : undefined,
          country: this.loginPreferenceDiffers(finalCountry, serverCountry) ? finalCountry : undefined,
          region: this.loginPreferenceDiffers(finalRegion, serverRegion) ? finalRegion : undefined,
        },
        { expectedVersion: session.metadata?.version },
      );
      if (patched) {
        this.applyPatchedLoginSession(session, patched);
      }
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          customerId: session.customerId,
          preferredSiteCode,
          preferredLanguage,
          preferredCountry,
          preferredRegion,
          targetCurrency: preferredLoginCurrency,
        },
        'Failed to realign session context with pre-login preferences',
      );
    }
    return { finalCurrency: preferredLoginCurrency, finalCountry };
  }

  private async bindCustomerCartAfterLogin(
    session: EmporixSessionContext,
    targetSiteCode: string,
    finalCurrency: string,
  ): Promise<{
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
  }> {
    if (!session.customerId) {
      return { verifiedCustomerCart: null };
    }
    try {
      const customerCartBinding = await this.safeEnsureCustomerCartBinding(
        session.customerId,
        targetSiteCode,
        finalCurrency,
      );
      const customerCartId = customerCartBinding.cartId;
      const verifiedCustomerCart =
        customerCartBinding.cart ??
        (customerCartId ? await this.getVerifiedCustomerCart(customerCartId, session.customerId) : null);
      if (customerCartId) {
        await this.sessionService.setCart(customerCartId);
      }
      return { customerCartBinding, customerCartId, verifiedCustomerCart };
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error) },
        'Failed to ensure customer cart binding after login',
      );
      return { verifiedCustomerCart: null };
    }
  }

  private notApplicableMerge(finalCurrency: string): {
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
    cartMergeStatus: Session['cartMergeStatus'];
    cartMergeReason?: Session['cartMergeReason'];
    finalCurrency: string;
  } {
    return {
      verifiedCustomerCart: null,
      cartMergeStatus: this.CART_MERGE_STATUS.NOT_APPLICABLE,
      cartMergeReason: this.CART_MERGE_REASON.ANONYMOUS_CART_NOT_ELIGIBLE,
      finalCurrency,
    };
  }

  private async resolveLoginCartMerge(args: {
    anonymousCartId?: string;
    session: EmporixSessionContext;
    targetSite: Site | null;
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    verifiedCustomerCart: Cart | null;
    customerCartId?: string;
    finalCurrency: string;
  }): Promise<{
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
    cartMergeStatus: Session['cartMergeStatus'];
    cartMergeReason?: Session['cartMergeReason'];
    finalCurrency: string;
  }> {
    const { anonymousCartId, session, verifiedCustomerCart, customerCartId, finalCurrency } = args;
    if (!anonymousCartId || !session.customerId) {
      return {
        ...this.notApplicableMerge(finalCurrency),
        verifiedCustomerCart,
        customerCartId,
      };
    }
    if (!verifiedCustomerCart) {
      return {
        customerCartId,
        verifiedCustomerCart: null,
        cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
        cartMergeReason: this.CART_MERGE_REASON.TARGET_CART_UNAVAILABLE,
        finalCurrency,
      };
    }
    return this.mergeAnonymousCartIfEligible({
      ...args,
      anonymousCartId,
      session,
      verifiedCustomerCart,
    });
  }

  private async mergeAnonymousCartIfEligible(args: {
    anonymousCartId: string;
    session: EmporixSessionContext;
    targetSite: Site | null;
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    verifiedCustomerCart: Cart;
    customerCartId?: string;
    finalCurrency: string;
  }): Promise<{
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
    cartMergeStatus: Session['cartMergeStatus'];
    cartMergeReason?: Session['cartMergeReason'];
    finalCurrency: string;
  }> {
    const { anonymousCartId, verifiedCustomerCart, customerCartId, finalCurrency } = args;
    try {
      const oldCart = await this.cartService.getCartById(anonymousCartId, false);
      if (!oldCart || oldCart.customerId || !oldCart.items?.length) {
        return {
          customerCartId,
          verifiedCustomerCart,
          cartMergeStatus: this.CART_MERGE_STATUS.NOT_APPLICABLE,
          cartMergeReason: this.CART_MERGE_REASON.ANONYMOUS_CART_NOT_ELIGIBLE,
          finalCurrency,
        };
      }
      if (oldCart.currency !== finalCurrency) {
        this.logger.error(
          {
            anonymousCartId: oldCart.id,
            customerCartId,
            anonymousCurrency: oldCart.currency,
            targetCurrency: finalCurrency,
            cartMergeReason: this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED,
          },
          'Cannot merge anonymous cart — currency mismatch after session settled',
        );
        return {
          customerCartId,
          verifiedCustomerCart,
          cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
          cartMergeReason: this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED,
          finalCurrency,
        };
      }
      return this.mergeEligibleAnonymousCart({ ...args, oldCart, verifiedCustomerCart });
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          anonymousCartId,
          customerCartId,
          cartMergeReason: this.CART_MERGE_REASON.TRANSITION_FAILED,
        },
        'Cart merge failed during login, continuing without merge',
      );
      return {
        customerCartId,
        verifiedCustomerCart,
        cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
        cartMergeReason: this.CART_MERGE_REASON.TRANSITION_FAILED,
        finalCurrency,
      };
    }
  }

  private async mergeEligibleAnonymousCart(args: {
    oldCart: Cart;
    session: EmporixSessionContext;
    targetSite: Site | null;
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    verifiedCustomerCart: Cart;
    customerCartId?: string;
    finalCurrency: string;
  }): Promise<{
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
    cartMergeStatus: Session['cartMergeStatus'];
    cartMergeReason?: Session['cartMergeReason'];
    finalCurrency: string;
  }> {
    const { oldCart, session, verifiedCustomerCart, customerCartId, finalCurrency } = args;
    const customerId = session.customerId;
    if (!customerId) {
      return {
        customerCartId,
        verifiedCustomerCart,
        cartMergeStatus: this.CART_MERGE_STATUS.NOT_APPLICABLE,
        cartMergeReason: this.CART_MERGE_REASON.ANONYMOUS_CART_NOT_ELIGIBLE,
        finalCurrency,
      };
    }
    const customerCartQuantityBeforeMerge = this.getCartQuantity(verifiedCustomerCart);
    const anonymousCartQuantity = this.getCartQuantity(oldCart);
    this.logger.debug(
      {
        targetCurrency: finalCurrency,
        anonymousCart: this.buildCartDebugSnapshot(oldCart),
        customerCart: this.buildCartDebugSnapshot(verifiedCustomerCart),
      },
      'Login merge pre-check snapshot (post-settle)',
    );

    try {
      const mergedCart = await this.mergeAndVerifyCarts(
        oldCart,
        verifiedCustomerCart,
        customerId,
        customerCartQuantityBeforeMerge,
        anonymousCartQuantity,
      );
      await this.sessionService.setCart(mergedCart.id);
      return {
        customerCartId: mergedCart.id,
        verifiedCustomerCart: mergedCart,
        cartMergeStatus: this.CART_MERGE_STATUS.MERGED,
        finalCurrency: mergedCart.currency,
      };
    } catch (mergeError) {
      return this.recoverFailedAnonymousMerge({
        ...args,
        mergeError,
        customerCartQuantityBeforeMerge,
        anonymousCartQuantity,
      });
    }
  }

  private async recoverFailedAnonymousMerge(args: {
    mergeError: unknown;
    oldCart: Cart;
    session: EmporixSessionContext;
    targetSite: Site | null;
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    verifiedCustomerCart: Cart;
    customerCartId?: string;
    finalCurrency: string;
    customerCartQuantityBeforeMerge: number;
    anonymousCartQuantity: number;
  }): Promise<{
    customerCartId?: string;
    verifiedCustomerCart: Cart | null;
    cartMergeStatus: Session['cartMergeStatus'];
    cartMergeReason?: Session['cartMergeReason'];
    finalCurrency: string;
  }> {
    const retriedMismatch = await this.tryRetryCurrencyMismatchMerge(args);
    if (retriedMismatch) {
      return retriedMismatch;
    }
    const retriedPrice = await this.tryRetryPriceMissingMerge(args);
    if (retriedPrice) {
      return retriedPrice;
    }
    this.logger.error(
      {
        err: args.mergeError instanceof Error ? args.mergeError : String(args.mergeError),
        oldCartId: args.oldCart.id,
        customerCartId: args.customerCartId,
        cartMergeReason: this.CART_MERGE_REASON.MERGE_FAILED,
      },
      'Failed to merge carts during login',
    );
    return {
      customerCartId: args.customerCartId,
      verifiedCustomerCart: args.verifiedCustomerCart,
      cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
      cartMergeReason: this.CART_MERGE_REASON.MERGE_FAILED,
      finalCurrency: args.finalCurrency,
    };
  }

  private async tryRetryCurrencyMismatchMerge(args: {
    mergeError: unknown;
    oldCart: Cart;
    session: EmporixSessionContext;
    verifiedCustomerCart: Cart;
    customerCartId?: string;
    finalCurrency: string;
    customerCartQuantityBeforeMerge: number;
    anonymousCartQuantity: number;
  }): Promise<
    | {
        customerCartId?: string;
        verifiedCustomerCart: Cart | null;
        cartMergeStatus: Session['cartMergeStatus'];
        cartMergeReason?: Session['cartMergeReason'];
        finalCurrency: string;
      }
    | undefined
  > {
    const customerId = args.session.customerId;
    if (
      !customerId ||
      !this.isMergeCurrencyMismatchError(args.mergeError) ||
      !args.customerCartId ||
      args.oldCart.currency !== args.finalCurrency
    ) {
      return undefined;
    }
    const retried = await this.retryMergeAfterCurrencyMismatch({
      sourceCart: args.oldCart,
      customerCart: args.verifiedCustomerCart,
      customerId,
      targetCurrency: args.finalCurrency,
      customerCartQuantityBeforeMerge: args.customerCartQuantityBeforeMerge,
      anonymousCartQuantity: args.anonymousCartQuantity,
    });
    if (!retried) {
      return undefined;
    }
    await this.sessionService.setCart(retried.id);
    return {
      customerCartId: retried.id,
      verifiedCustomerCart: retried,
      cartMergeStatus: this.CART_MERGE_STATUS.MERGED,
      finalCurrency: retried.currency,
    };
  }

  private async tryRetryPriceMissingMerge(args: {
    mergeError: unknown;
    oldCart: Cart;
    session: EmporixSessionContext;
    targetSite: Site | null;
    customerCartBinding?: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart };
    verifiedCustomerCart: Cart;
    customerCartId?: string;
    finalCurrency: string;
    customerCartQuantityBeforeMerge: number;
    anonymousCartQuantity: number;
  }): Promise<
    | {
        customerCartId?: string;
        verifiedCustomerCart: Cart | null;
        cartMergeStatus: Session['cartMergeStatus'];
        cartMergeReason?: Session['cartMergeReason'];
        finalCurrency: string;
      }
    | undefined
  > {
    const retryCurrency = this.resolveMergeRetryCurrency(args.targetSite, args.finalCurrency);
    const shouldRetry =
      args.customerCartBinding?.created &&
      this.isPriceMissingMergeError(args.mergeError) &&
      retryCurrency !== undefined &&
      retryCurrency !== args.finalCurrency;
    const customerId = args.session.customerId;
    if (!shouldRetry || !retryCurrency || !customerId) {
      return undefined;
    }

    const retriedAnonymousCartAlignment = await this.alignCartCurrency(args.oldCart, retryCurrency, {
      allowRefreshOnlyFailure: true,
    });
    if (!retriedAnonymousCartAlignment.cart) {
      return {
        customerCartId: args.customerCartId,
        verifiedCustomerCart: args.verifiedCustomerCart,
        cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
        cartMergeReason: retriedAnonymousCartAlignment.reason || this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED,
        finalCurrency: args.finalCurrency,
      };
    }

    const retriedCustomerCartAlignment = await this.alignCartCurrency(args.verifiedCustomerCart, retryCurrency, {
      expectedCustomerId: args.session.customerId,
    });
    if (!retriedCustomerCartAlignment.cart) {
      return {
        customerCartId: args.customerCartId,
        verifiedCustomerCart: args.verifiedCustomerCart,
        cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
        cartMergeReason: retriedCustomerCartAlignment.reason || this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED,
        finalCurrency: args.finalCurrency,
      };
    }

    try {
      const mergedCart = await this.mergeAndVerifyCarts(
        retriedAnonymousCartAlignment.cart,
        retriedCustomerCartAlignment.cart,
        customerId,
        args.customerCartQuantityBeforeMerge,
        args.anonymousCartQuantity,
      );
      await this.sessionService.setCart(mergedCart.id);
      return {
        customerCartId: mergedCart.id,
        verifiedCustomerCart: mergedCart,
        cartMergeStatus: this.CART_MERGE_STATUS.MERGED,
        finalCurrency: mergedCart.currency,
      };
    } catch (retryError) {
      this.logger.error(
        {
          err: retryError instanceof Error ? retryError : String(retryError),
          oldCartId: args.oldCart.id,
          customerCartId: args.customerCartId,
          retryCurrency,
          cartMergeReason: this.CART_MERGE_REASON.MERGE_FAILED,
        },
        'Failed to merge carts during login after retrying with fallback currency',
      );
      return {
        customerCartId: args.customerCartId,
        verifiedCustomerCart: args.verifiedCustomerCart,
        cartMergeStatus: this.CART_MERGE_STATUS.FALLBACK,
        cartMergeReason: this.CART_MERGE_REASON.MERGE_FAILED,
        finalCurrency: args.finalCurrency,
      };
    }
  }

  private async enforceLoginCartPreferences(args: {
    session: EmporixSessionContext;
    verifiedCustomerCart: Cart | null;
    preferredLoginCurrency: string;
    finalCountry: string | undefined;
  }): Promise<Cart | null> {
    const { session, preferredLoginCurrency, finalCountry } = args;
    let { verifiedCustomerCart } = args;
    if (!verifiedCustomerCart) {
      return null;
    }
    if (session.customerId && preferredLoginCurrency && verifiedCustomerCart.currency !== preferredLoginCurrency) {
      const enforcedCurrencyCart = await this.alignCartCurrency(verifiedCustomerCart, preferredLoginCurrency, {
        expectedCustomerId: session.customerId,
      });
      if (enforcedCurrencyCart.cart) {
        verifiedCustomerCart = enforcedCurrencyCart.cart;
      } else {
        this.logger.warn(
          {
            customerId: session.customerId,
            cartId: verifiedCustomerCart.id,
            currentCurrency: verifiedCustomerCart.currency,
            preferredLoginCurrency,
          },
          'Failed to enforce preferred login currency on customer cart',
        );
      }
    }
    if (finalCountry) {
      try {
        await this.cartService.alignCartCountry(verifiedCustomerCart.id, finalCountry);
      } catch (error) {
        this.logger.warn(
          {
            err: error instanceof Error ? error : String(error),
            cartId: verifiedCustomerCart.id,
            country: finalCountry,
          },
          'Failed to align cart country with session after login',
        );
      }
    }
    return verifiedCustomerCart;
  }

  async logout(): Promise<void> {
    await this.emporixCustomerApi.logout();
  }

  async register(registration: Registration): Promise<Session> {
    if (!registration.credentials.password) {
      throw new Error('Missing Password');
    }
    const customer: Omit<EmporixCustomer, 'id' | 'customerNumber'> = {
      contactEmail: registration.credentials.username,
      firstName: registration.customer?.firstName,
      lastName: registration.customer?.lastName,
      company: registration.customer?.company,
    };
    if (customer.company) {
      customer.businessModel = 'B2B';
      customer.b2b = {
        // TODO: Add actual company registration ID
        companyRegistrationId: '123-456-789',
      };
    } else {
      customer.businessModel = 'B2C';
    }

    const currentSession = await this.sessionService.getCurrent();
    if (!currentSession) {
      // GET /session-context/{tenant}/me/context is 404 until a cart exists.
      // Signup only needs an anonymous token, not that document.
      this.logger.warn({}, 'Registration proceeding without session context');
    }

    const preferences = this.resolveSignupPreferences(currentSession, registration);
    customer.preferredLanguage = preferences.preferredLanguage;
    customer.preferredCurrency = preferences.preferredCurrency;
    customer.preferredSite = preferences.preferredSite;

    const address: EmporixAddress | undefined = registration.address
      ? this.emporixAddressMapper.mapToSource(registration.address)
      : undefined;
    if (address && registration.address?.tags) {
      address.tags = registration.address.tags;
    }
    const session = await this.emporixCustomerApi.signup({
      email: registration.credentials.username,
      password: registration.credentials.password,
      customerDetails: customer,
      customerAddress: address,
    });

    if (!session) {
      throw new Error('Failed to register User');
    }
    return this.login(registration.credentials);
  }

  /**
   * Session context is optional at signup (404 when no cart yet). Prefer the
   * live session, then the registration payload, then public env defaults.
   */
  private resolveSignupPreferences(
    currentSession: Awaited<ReturnType<SessionService['getCurrent']>>,
    registration: Registration,
  ): { preferredLanguage: string; preferredCurrency: string; preferredSite: string } {
    return {
      preferredLanguage: currentSession?.language || registration.customer?.language || getPublicDefaultLanguage(),
      preferredCurrency: currentSession?.currency || registration.customer?.currency || getPublicDefaultCurrency(),
      preferredSite: currentSession?.siteCode || getPublicDefaultSite(),
    };
  }

  async getCurrentSession(): Promise<Session | null> {
    const session = await this.emporixSessionContextApi.getOwnSessionContext();

    if (!session) {
      return null;
    }
    return {
      sessionId: session.sessionId,
      customerId: session.customerId,
      siteCode: session.siteCode,
      currency: session.currency,
      cartId: session.cartId,
      country: session.targetLocation,
    };
  }

  private generateSsoPassword(username: string): string {
    const secret = process.env.NEXT_SSO_PASSWORD_SECRET;

    if (!secret) {
      throw new Error('NEXT_SSO_PASSWORD_SECRET environment variable is not configured');
    }

    const combined = secret + username;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    return hash;
  }

  private mapCurrencyAlignmentFailure(error: unknown): Session['cartMergeReason'] {
    if (error instanceof CartCurrencyUpdateError) {
      if (error.code === CART_CURRENCY_UPDATE_ERROR_CODE.UNSUPPORTED_CURRENCY) {
        return this.CART_MERGE_REASON.UNSUPPORTED_CURRENCY;
      }
    }
    return this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED;
  }

  private buildLoginResult(
    session: EmporixSessionContext,
    cartId: string | undefined,
    cartMergeStatus: Session['cartMergeStatus'],
    cartMergeReason?: Session['cartMergeReason'],
  ): Session {
    return {
      sessionId: session.sessionId,
      customerId: session.customerId,
      siteCode: session.siteCode,
      currency: session.currency,
      cartId,
      country: session.targetLocation,
      cartMergeStatus,
      cartMergeReason,
    };
  }

  private async safeGetSite(siteCode: string): Promise<Site | null> {
    try {
      return await this.siteService.getSite(siteCode);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error), siteCode },
        'Failed to resolve site during login',
      );
      return null;
    }
  }

  private resolveFinalLoginCurrency(
    site: Site | null,
    shopperSelectedCurrency?: string,
    customerCurrency?: string,
  ): string {
    if (!site) {
      return customerCurrency || shopperSelectedCurrency || getPublicDefaultCurrency();
    }

    if (this.isCurrencySupportedOnSite(site, shopperSelectedCurrency)) {
      return shopperSelectedCurrency!;
    }
    if (this.isCurrencySupportedOnSite(site, customerCurrency)) {
      return customerCurrency!;
    }
    return site.defaultCurrency?.id || customerCurrency || shopperSelectedCurrency || getPublicDefaultCurrency();
  }

  private isCurrencySupportedOnSite(site: Site, currency?: string): boolean {
    if (!currency) {
      return false;
    }

    const supportedCurrencies = new Set<string>();
    if (site.defaultCurrency?.id) {
      supportedCurrencies.add(site.defaultCurrency.id);
    }
    if (site.defaultCurrency?.code) {
      supportedCurrencies.add(site.defaultCurrency.code);
    }
    site.currencies?.forEach((entry) => {
      if (entry.id) {
        supportedCurrencies.add(entry.id);
      }
      if (entry.code) {
        supportedCurrencies.add(entry.code);
      }
    });
    return supportedCurrencies.has(currency);
  }

  private resolveMergeRetryCurrency(site: Site | null, currentCurrency: string): string | undefined {
    if (!site) {
      return undefined;
    }

    const siteDefaultCurrency = site.defaultCurrency?.id || site.defaultCurrency?.code;
    if (siteDefaultCurrency && siteDefaultCurrency !== currentCurrency) {
      return siteDefaultCurrency;
    }

    return undefined;
  }

  private isPriceMissingMergeError(error: unknown): boolean {
    return error instanceof Error && /No price has been found/i.test(error.message);
  }

  private isMergeCurrencyMismatchError(error: unknown): boolean {
    return (
      error instanceof Error && /All the items must have the same currency when merging carts/i.test(error.message)
    );
  }

  private getCartQuantity(cart: Cart | null | undefined): number {
    return cart?.items?.reduce((total, item) => total + (item.quantity || 0), 0) || 0;
  }

  private isAnonymousCartRefreshOnlyError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Anonymous cart cannot be assigned to a legal entity');
  }

  private async getVerifiedCustomerCart(cartId: string, customerId: string): Promise<Cart | null> {
    const cart = await this.cartService.getCartById(cartId, false);
    if (!cart || cart.customerId !== customerId) {
      return null;
    }
    return cart;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForCartState(
    getCart: () => Promise<Cart | null>,
    isValid: (cart: Cart | null) => boolean,
  ): Promise<Cart | null> {
    let latestCart: Cart | null = null;

    for (let attempt = 0; attempt < this.CART_VERIFICATION_ATTEMPTS; attempt += 1) {
      latestCart = await getCart();
      if (isValid(latestCart)) {
        return latestCart;
      }

      if (attempt < this.CART_VERIFICATION_ATTEMPTS - 1) {
        const delay = Math.min(
          this.CART_VERIFICATION_DELAY_MS * Math.pow(2, attempt),
          this.CART_VERIFICATION_MAX_DELAY_MS,
        );
        await this.delay(delay);
      }
    }

    return latestCart;
  }

  private async alignCartCurrency(
    cart: Cart,
    targetCurrency: string,
    options: { allowRefreshOnlyFailure?: boolean; expectedCustomerId?: string } = {},
  ): Promise<{ cart?: Cart; reason?: Session['cartMergeReason'] }> {
    let currencyUpdateAccepted = false;

    if (cart.currency !== targetCurrency) {
      try {
        await this.cartService.updateCurrency(cart.id, targetCurrency);
        currencyUpdateAccepted = true;
      } catch (error) {
        if (!(options.allowRefreshOnlyFailure && this.isAnonymousCartRefreshOnlyError(error))) {
          return { reason: this.mapCurrencyAlignmentFailure(error) };
        }
        this.logger.info(
          { cartId: cart.id, targetCurrency },
          'Cart currency changed but refresh was skipped; verifying cart state directly',
        );
      }
    }

    const verifiedCart = await this.waitForCartState(
      () =>
        options.expectedCustomerId
          ? this.getVerifiedCustomerCart(cart.id, options.expectedCustomerId)
          : this.cartService.getCartById(cart.id, false),
      (candidateCart) => !!candidateCart && candidateCart.currency === targetCurrency,
    );
    const verificationFailed = !verifiedCart || verifiedCart.currency !== targetCurrency;

    if (verificationFailed && options.expectedCustomerId && cart.customerId === options.expectedCustomerId) {
      // Final read via current customer cart endpoint to absorb delayed currency propagation.
      const currentCustomerCart = await this.cartService.getCart();
      if (
        currentCustomerCart?.id === cart.id &&
        currentCustomerCart.customerId === options.expectedCustomerId &&
        currentCustomerCart.currency === targetCurrency
      ) {
        return { cart: currentCustomerCart };
      }
    }

    if (
      verificationFailed &&
      currencyUpdateAccepted &&
      options.expectedCustomerId &&
      cart.customerId === options.expectedCustomerId
    ) {
      this.logger.warn(
        {
          cartId: cart.id,
          customerId: options.expectedCustomerId,
          targetCurrency,
        },
        'Customer cart currency verification timed out after successful repricing; continuing optimistically',
      );
      return { cart: { ...cart, currency: targetCurrency } };
    }

    if (verificationFailed) {
      return { reason: this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED };
    }

    return { cart: verifiedCart };
  }

  private async mergeAndVerifyCarts(
    anonymousCart: Cart,
    customerCart: Cart,
    customerId: string,
    customerCartQuantityBeforeMerge: number,
    anonymousCartQuantity: number,
  ): Promise<Cart> {
    const [latestAnonymousCart, latestCustomerCart] = await Promise.all([
      this.cartService.getCartById(anonymousCart.id, false),
      this.cartService.getCartById(customerCart.id, false),
    ]);
    this.logger.debug(
      {
        anonymousCart: this.buildCartDebugSnapshot(latestAnonymousCart || anonymousCart),
        customerCart: this.buildCartDebugSnapshot(latestCustomerCart || customerCart),
      },
      'Login merge preflight live snapshot',
    );

    try {
      await this.cartMigrationService.mergeCarts(anonymousCart.id, customerCart.id);
    } catch (error) {
      const [anonymousAfterError, customerAfterError] = await Promise.all([
        this.cartService.getCartById(anonymousCart.id, false),
        this.cartService.getCartById(customerCart.id, false),
      ]);
      this.logger.debug(
        {
          err: error instanceof Error ? error : String(error),
          anonymousCart: this.buildCartDebugSnapshot(anonymousAfterError || anonymousCart),
          customerCart: this.buildCartDebugSnapshot(customerAfterError || customerCart),
        },
        'Login merge failed with live cart snapshots',
      );
      throw error;
    }

    const mergedCart = await this.waitForCartState(
      () => this.getVerifiedCustomerCart(customerCart.id, customerId),
      (candidateCart) => this.getCartQuantity(candidateCart) >= customerCartQuantityBeforeMerge + anonymousCartQuantity,
    );
    const minimumExpectedQuantity = customerCartQuantityBeforeMerge + anonymousCartQuantity;

    if (!mergedCart || this.getCartQuantity(mergedCart) < minimumExpectedQuantity) {
      this.logger.error(
        {
          anonymousCartId: anonymousCart.id,
          customerCartId: customerCart.id,
          customerCartQuantityBeforeMerge,
          anonymousCartQuantity,
          mergedCartQuantity: this.getCartQuantity(mergedCart),
        },
        'Merged cart verification failed after login transition',
      );
      throw new Error('Merged cart verification failed');
    }

    return mergedCart;
  }

  private async retryMergeAfterCurrencyMismatch(params: {
    sourceCart: Cart;
    customerCart: Cart;
    customerId: string;
    targetCurrency: string;
    customerCartQuantityBeforeMerge: number;
    anonymousCartQuantity: number;
  }): Promise<Cart | null> {
    const {
      sourceCart,
      customerCart,
      customerId,
      targetCurrency,
      customerCartQuantityBeforeMerge,
      anonymousCartQuantity,
    } = params;

    for (let attempt = 1; attempt <= this.MERGE_CURRENCY_RETRY_ATTEMPTS; attempt += 1) {
      try {
        await this.cartService.updateCurrency(customerCart.id, targetCurrency);
        await this.delay(this.MERGE_CURRENCY_RETRY_DELAY_MS * attempt);

        const refreshedCustomerCart = (await this.getVerifiedCustomerCart(customerCart.id, customerId)) || customerCart;
        if (refreshedCustomerCart.currency !== targetCurrency) {
          this.logger.debug(
            {
              attempt,
              customerCartId: customerCart.id,
              observedCurrency: refreshedCustomerCart.currency,
              targetCurrency,
            },
            'Merge retry skipped because customer cart is still not in target currency',
          );
          continue;
        }

        this.logger.debug(
          {
            attempt,
            customerCartId: customerCart.id,
            anonymousCartId: sourceCart.id,
            targetCurrency,
          },
          'Retrying merge after currency mismatch error',
        );

        return await this.mergeAndVerifyCarts(
          sourceCart,
          refreshedCustomerCart,
          customerId,
          customerCartQuantityBeforeMerge,
          anonymousCartQuantity,
        );
      } catch (retryError) {
        const isFinalAttempt = attempt === this.MERGE_CURRENCY_RETRY_ATTEMPTS;
        this.logger.debug(
          {
            attempt,
            maxAttempts: this.MERGE_CURRENCY_RETRY_ATTEMPTS,
            err: retryError instanceof Error ? retryError : String(retryError),
            customerCartId: customerCart.id,
            anonymousCartId: sourceCart.id,
            targetCurrency,
          },
          'Merge retry after currency mismatch failed',
        );
        if (isFinalAttempt) {
          return null;
        }
      }
    }

    return null;
  }

  private getCartItemCurrencies(cart: Cart | null | undefined): string[] {
    if (!cart?.items) {
      return [];
    }

    const currencies = new Set<string>();
    cart.items.forEach((item) => {
      const currency = item?.price?.currency;
      if (currency) {
        currencies.add(currency);
      }
    });
    return [...currencies].sort();
  }

  private buildCartDebugSnapshot(cart: Cart | null | undefined): {
    id?: string;
    customerId?: string;
    currency?: string;
    itemCount: number;
    quantity: number;
    itemCurrencies: string[];
  } {
    return {
      id: cart?.id,
      customerId: cart?.customerId,
      currency: cart?.currency,
      itemCount: cart?.items?.length || 0,
      quantity: this.getCartQuantity(cart),
      itemCurrencies: this.getCartItemCurrencies(cart),
    };
  }

  private async ensureCustomerCartBinding(
    customerId: string,
    siteCode: string,
    currency?: string,
    preferredCartId?: string,
  ): Promise<{ cartId: string; currencyAligned: boolean; created: boolean; cart?: Cart }> {
    if (preferredCartId) {
      const preferredCart = await this.cartService.getCartById(preferredCartId, false);
      if (preferredCart?.customerId === customerId) {
        let verifiedPreferredCart = preferredCart;
        if (currency && preferredCart.currency !== currency) {
          await this.cartService.updateCurrency(preferredCartId, currency);
          verifiedPreferredCart =
            (await this.waitForCartState(
              () => this.cartService.getCartById(preferredCartId, false),
              (candidateCart) => !!candidateCart && candidateCart.currency === currency,
            )) || preferredCart;
        }
        return {
          cartId: preferredCartId,
          currencyAligned: !currency || verifiedPreferredCart.currency === currency,
          created: false,
          cart: verifiedPreferredCart,
        };
      }
    }

    const existingCustomerCart = await this.cartService.getCart();
    if (existingCustomerCart?.customerId === customerId) {
      let verifiedExistingCustomerCart = existingCustomerCart;
      if (currency && existingCustomerCart.currency !== currency) {
        await this.cartService.updateCurrency(existingCustomerCart.id, currency);
        verifiedExistingCustomerCart =
          (await this.waitForCartState(
            () => this.cartService.getCartById(existingCustomerCart.id, false),
            (candidateCart) => !!candidateCart && candidateCart.currency === currency,
          )) || existingCustomerCart;
      }
      return {
        cartId: existingCustomerCart.id,
        currencyAligned: !currency || verifiedExistingCustomerCart.currency === currency,
        created: false,
        cart: verifiedExistingCustomerCart,
      };
    }

    const createdCartId = await this.cartService.createCart(currency || getPublicDefaultCurrency(), siteCode);
    const createdCart = await this.getVerifiedCustomerCart(createdCartId, customerId);
    return {
      cartId: createdCartId,
      currencyAligned: !currency || createdCart?.currency === currency,
      created: true,
      cart: createdCart || undefined,
    };
  }

  private async safeEnsureCustomerCartBinding(
    customerId: string,
    siteCode: string,
    currency?: string,
    preferredCartId?: string,
  ): Promise<{ cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart }> {
    try {
      return await this.ensureCustomerCartBinding(customerId, siteCode, currency, preferredCartId);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          customerId,
          siteCode,
          preferredCartId,
        },
        'Failed to ensure customer cart binding',
      );
      return {
        cartId: preferredCartId,
        currencyAligned: false,
        created: false,
        cart: undefined,
      };
    }
  }
}

export default EmporixAuthService;
