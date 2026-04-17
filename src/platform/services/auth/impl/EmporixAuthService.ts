import crypto from 'crypto';
import { inject } from 'inversify';
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
  private readonly DEFAULT_CURRENCY = 'EUR';
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
    const password = credentials.password || this.generateSsoPassword(credentials.username);
    const session = await this.emporixCustomerApi.login(credentials.username, password);
    if (!session) {
      throw new Error('Failed to get session context');
    }
    const targetSiteCode = session.siteCode || oldSession?.siteCode || 'main';
    const targetSite = await this.safeGetSite(targetSiteCode);
    let finalCurrency = this.resolveFinalLoginCurrency(targetSite, oldSession?.currency, session.currency);
    const preferredLoginCurrency = finalCurrency;
    let customerCartId: string | undefined;
    let customerCartBinding: { cartId?: string; currencyAligned: boolean; created: boolean; cart?: Cart } | undefined;
    let verifiedCustomerCart: Cart | null = null;
    let cartMergeStatus: Session['cartMergeStatus'] = this.CART_MERGE_STATUS.NOT_APPLICABLE;
    let cartMergeReason: Session['cartMergeReason'] | undefined;
    if (oldSession) {
      try {
        const oldCartId = oldSession.cartId;
        const oldCart = oldCartId ? await this.cartService.getCartById(oldCartId, false) : null;
        if (oldCart && !oldCart.customerId && oldCart.items?.length > 0 && session.customerId) {
          const customerCart = await this.cartService.getCart();
          customerCartBinding = await this.ensureCustomerCartBinding(
            session.customerId,
            targetSiteCode,
            finalCurrency,
            customerCart?.id,
          );
          customerCartId = customerCartBinding.cartId;
          verifiedCustomerCart =
            customerCartBinding.cart ??
            (customerCartId ? await this.getVerifiedCustomerCart(customerCartId, session.customerId) : null);

          if (!verifiedCustomerCart) {
            cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
            cartMergeReason = this.CART_MERGE_REASON.TARGET_CART_UNAVAILABLE;
            if (customerCartId) {
              await this.sessionService.setCart(customerCartId);
            }
          } else {
            const alignedCustomerCart = await this.alignCartCurrency(verifiedCustomerCart, finalCurrency, {
              expectedCustomerId: session.customerId,
            });

            if (!alignedCustomerCart.cart) {
              cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
              cartMergeReason = alignedCustomerCart.reason;
              this.logger.error(
                {
                  anonymousCartId: oldCart.id,
                  customerCartId,
                  customerCurrency: verifiedCustomerCart.currency,
                  targetCurrency: finalCurrency,
                  cartMergeReason,
                },
                'Failed to align customer cart currency before login merge',
              );
              await this.sessionService.setCart(customerCartId!);
            } else {
              verifiedCustomerCart = alignedCustomerCart.cart;
              finalCurrency = verifiedCustomerCart.currency;
              if (oldCart.currency !== finalCurrency) {
                cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
                cartMergeReason = this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED;
                this.logger.error(
                  {
                    anonymousCartId: oldCart.id,
                    customerCartId,
                    anonymousCurrency: oldCart.currency,
                    targetCurrency: finalCurrency,
                    cartMergeReason,
                  },
                  'Failed to align anonymous cart currency before login merge',
                );
                await this.sessionService.setCart(customerCartId!);
              } else {
                const alignedSourceCart = oldCart;
                const customerCartQuantityBeforeMerge = this.getCartQuantity(verifiedCustomerCart);
                const anonymousCartQuantity = this.getCartQuantity(alignedSourceCart);
                this.logger.debug(
                  {
                    targetCurrency: finalCurrency,
                    anonymousCart: this.buildCartDebugSnapshot(alignedSourceCart),
                    customerCart: this.buildCartDebugSnapshot(verifiedCustomerCart),
                  },
                  'Login merge pre-check snapshot',
                );

                try {
                  const mergedCart = await this.mergeAndVerifyCarts(
                    alignedSourceCart,
                    verifiedCustomerCart,
                    session.customerId,
                    customerCartQuantityBeforeMerge,
                    anonymousCartQuantity,
                  );
                  await this.sessionService.setCart(mergedCart.id);
                  customerCartId = mergedCart.id;
                  verifiedCustomerCart = mergedCart;
                  finalCurrency = mergedCart.currency;
                  cartMergeStatus = this.CART_MERGE_STATUS.MERGED;
                } catch (mergeError) {
                  let mergeRecovered = false;
                  const shouldRetryCurrencyMismatch =
                    this.isMergeCurrencyMismatchError(mergeError) &&
                    !!customerCartId &&
                    alignedSourceCart.currency === finalCurrency;
                  if (shouldRetryCurrencyMismatch) {
                    const retriedCurrencyMismatchMerge = await this.retryMergeAfterCurrencyMismatch({
                      sourceCart: alignedSourceCart,
                      customerCart: verifiedCustomerCart,
                      customerId: session.customerId,
                      targetCurrency: finalCurrency,
                      customerCartQuantityBeforeMerge,
                      anonymousCartQuantity,
                    });

                    if (retriedCurrencyMismatchMerge) {
                      await this.sessionService.setCart(retriedCurrencyMismatchMerge.id);
                      customerCartId = retriedCurrencyMismatchMerge.id;
                      verifiedCustomerCart = retriedCurrencyMismatchMerge;
                      finalCurrency = retriedCurrencyMismatchMerge.currency;
                      cartMergeStatus = this.CART_MERGE_STATUS.MERGED;
                      mergeRecovered = true;
                    }
                  }

                  if (!mergeRecovered) {
                    const retryCurrency = this.resolveMergeRetryCurrency(targetSite, finalCurrency);
                    const shouldRetryMerge =
                      customerCartBinding?.created &&
                      this.isPriceMissingMergeError(mergeError) &&
                      retryCurrency !== undefined &&
                      retryCurrency !== finalCurrency &&
                      alignedSourceCart.currency === retryCurrency;

                    if (shouldRetryMerge) {
                      const retriedCustomerCartAlignment = await this.alignCartCurrency(
                        verifiedCustomerCart,
                        retryCurrency,
                        {
                          expectedCustomerId: session.customerId,
                        },
                      );
                      const canRetryWithAnonymousCurrency = alignedSourceCart.currency === retryCurrency;

                      if (!retriedCustomerCartAlignment.cart || !canRetryWithAnonymousCurrency) {
                        cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
                        cartMergeReason =
                          retriedCustomerCartAlignment.reason || this.CART_MERGE_REASON.CURRENCY_ALIGNMENT_FAILED;
                        await this.sessionService.setCart(customerCartId!);
                      } else {
                        try {
                          const mergedCart = await this.mergeAndVerifyCarts(
                            alignedSourceCart,
                            retriedCustomerCartAlignment.cart,
                            session.customerId,
                            customerCartQuantityBeforeMerge,
                            anonymousCartQuantity,
                          );
                          await this.sessionService.setCart(mergedCart.id);
                          customerCartId = mergedCart.id;
                          verifiedCustomerCart = mergedCart;
                          finalCurrency = mergedCart.currency;
                          cartMergeStatus = this.CART_MERGE_STATUS.MERGED;
                        } catch (retryError) {
                          cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
                          cartMergeReason = this.CART_MERGE_REASON.MERGE_FAILED;
                          this.logger.error(
                            {
                              err: retryError instanceof Error ? retryError : String(retryError),
                              oldCartId: alignedSourceCart.id,
                              customerCartId,
                              retryCurrency,
                              cartMergeReason,
                            },
                            'Failed to merge carts during login after retrying with fallback currency',
                          );
                          await this.sessionService.setCart(customerCartId!);
                        }
                      }
                    } else {
                      cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
                      cartMergeReason = this.CART_MERGE_REASON.MERGE_FAILED;
                      this.logger.error(
                        {
                          err: mergeError instanceof Error ? mergeError : String(mergeError),
                          oldCartId: alignedSourceCart.id,
                          customerCartId,
                          cartMergeReason,
                        },
                        'Failed to merge carts during login',
                      );
                      await this.sessionService.setCart(customerCartId!);
                    }
                  }
                }
              }
            }
          }
        } else {
          cartMergeStatus = this.CART_MERGE_STATUS.NOT_APPLICABLE;
          cartMergeReason = this.CART_MERGE_REASON.ANONYMOUS_CART_NOT_ELIGIBLE;
        }

        if (session.customerId && cartMergeStatus !== this.CART_MERGE_STATUS.MERGED) {
          customerCartBinding =
            customerCartBinding ??
            (await this.safeEnsureCustomerCartBinding(
              session.customerId,
              targetSiteCode,
              finalCurrency,
              customerCartId,
            ));
          customerCartId = customerCartBinding.cartId;
          verifiedCustomerCart =
            customerCartBinding.cart ??
            (customerCartId ? await this.getVerifiedCustomerCart(customerCartId, session.customerId) : null);
          if (customerCartId) {
            await this.sessionService.setCart(customerCartId);
          }
        }
      } catch (error) {
        cartMergeStatus = this.CART_MERGE_STATUS.FALLBACK;
        cartMergeReason = this.CART_MERGE_REASON.TRANSITION_FAILED;
        this.logger.error(
          { err: error instanceof Error ? error : String(error), cartMergeReason },
          'Cart transition failed during login, continuing without merge',
        );
        if (session.customerId) {
          customerCartBinding = await this.safeEnsureCustomerCartBinding(
            session.customerId,
            targetSiteCode,
            finalCurrency,
            customerCartId,
          );
          customerCartId = customerCartBinding.cartId;
          verifiedCustomerCart =
            customerCartBinding.cart ??
            (customerCartId ? await this.getVerifiedCustomerCart(customerCartId, session.customerId) : null);
          if (customerCartId) {
            await this.sessionService.setCart(customerCartId);
          }
        }
      }
    }

    if (session.customerId && !customerCartId) {
      customerCartBinding = await this.safeEnsureCustomerCartBinding(
        session.customerId,
        targetSiteCode,
        finalCurrency,
        customerCartId,
      );
      customerCartId = customerCartBinding.cartId;
      verifiedCustomerCart =
        customerCartBinding.cart ??
        (customerCartId ? await this.getVerifiedCustomerCart(customerCartId, session.customerId) : null);
      if (customerCartId) {
        await this.sessionService.setCart(customerCartId);
      }
    }

    if (verifiedCustomerCart) {
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
      finalCurrency = verifiedCustomerCart.currency;
    }

    if (verifiedCustomerCart && session.currency !== verifiedCustomerCart.currency) {
      try {
        await this.sessionService.setCurrency(verifiedCustomerCart.currency);
        session.currency = verifiedCustomerCart.currency;
      } catch (error) {
        this.logger.error(
          {
            err: error instanceof Error ? error : String(error),
            customerId: session.customerId,
            cartId: verifiedCustomerCart.id,
            currentCurrency: session.currency,
            targetCurrency: verifiedCustomerCart.currency,
          },
          'Failed to sync session currency after login cart transition',
        );
      }
    }

    return this.buildLoginResult(session, customerCartId, cartMergeStatus, cartMergeReason);
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
      throw new Error('Failed to get session context');
    }

    customer.preferredLanguage = currentSession.language || 'en';
    customer.preferredCurrency = currentSession.currency || 'EUR';
    customer.preferredSite = currentSession.siteCode;

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
      return customerCurrency || shopperSelectedCurrency || this.DEFAULT_CURRENCY;
    }

    if (this.isCurrencySupportedOnSite(site, shopperSelectedCurrency)) {
      return shopperSelectedCurrency!;
    }
    if (this.isCurrencySupportedOnSite(site, customerCurrency)) {
      return customerCurrency!;
    }
    return site.defaultCurrency?.id || customerCurrency || shopperSelectedCurrency || this.DEFAULT_CURRENCY;
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

    const createdCartId = await this.cartService.createCart(currency || this.DEFAULT_CURRENCY, siteCode);
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
