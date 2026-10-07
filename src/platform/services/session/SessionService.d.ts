import { Session, SessionAttribute } from '@/platform/services/model/session/session';

/**
 * Service for managing the current user's session context
 */
export interface SessionService {
  /**
   * Get the current session context. Resolves `undefined` both when there is no session and when
   * the session lookup fails (best-effort read for SSR / display paths).
   */
  getCurrent(): Promise<Session | undefined>;

  /**
   * Get the current session context; `undefined` only when there is no session. A failed lookup
   * rejects so access-gating callers (e.g. `ProductsModeService`) can fail closed instead of
   * mistaking an outage for an anonymous visitor.
   */
  getCurrentOrThrow(): Promise<Session | undefined>;

  /**
   * Get the current session context
   */
  getById(id: string): Promise<Session | undefined>;

  /**
   * Set the language for the current session context
   */
  setLanguage(language: string): Promise<void>;

  /**
   * Set the currency for the current session context
   */
  setCurrency(currency: string): Promise<void>;

  /**
   * Set the country for the current session context
   */
  setCountry(country: string): Promise<void>;

  /**
   * Set the site for the current session context.
   * When switching sites, optionally reset the session currency to the target site's default.
   * @param site - Site code to set
   * @param defaultCurrency - Optional default currency of the target site. When provided and site actually changes, the session currency is reset to this value.
   */
  setSite(site: string, defaultCurrency?: string): Promise<void>;

  /**
   * Set the region for the current session context
   */
  setRegion(region: string): Promise<void>;

  /**
   * Set the cart for the current session context
   */
  setCart(cartId: string): Promise<void>;

  /**
   * Clear the cart reference from the current session context.
   * Removes the 'currentCart' attribute from the Emporix session.
   */
  clearCart(): Promise<void>;

  /**
   * Set the legal entity (company) for the current session context
   * This refreshes the customer token first and fails without changing session context
   * when the token cannot be reminted with the requested legal entity.
   */
  setLegalEntity(legalEntityId: string): Promise<{ tokenRefreshSucceeded: true; tokenLooksLikeJwt: boolean }>;

  /**
   * Read the validated legal-entity scope from the current customer token, falling
   * back to supported JWT claim shapes when validation is unavailable.
   * The token itself is never returned or logged.
   */
  getCustomerTokenLegalEntityId(): Promise<string | undefined>;

  /**
   * Clear the legal entity (company) reference from the current session context.
   * Removes the 'legalEntityId' attribute and refreshes the customer token
   * without a legal-entity scope. Safe to call even when no legal entity is set.
   */
  clearLegalEntity(): Promise<void>;

  /**
   * Update multiple first-class session fields in one upstream PATCH. Prefer over chaining
   * `setX` calls. `expectedVersion` skips the pre-PATCH read on the happy path; conflicts
   * fall back to one read + one retry. Does not mutate `currentCart` — cart resolution lives
   * in the client-side site-switch orchestrator.
   */
  updateContext(
    fields: {
      siteCode?: string;
      currency?: string;
      language?: string;
      country?: string;
      region?: string;
    },
    opts?: { expectedVersion?: number },
  ): Promise<Session | undefined>;
}
