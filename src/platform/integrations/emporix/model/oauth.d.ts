export interface EmporixAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
export interface EmporixRefreshTokenResponse {
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/**
 * Response type for anonymous token requests
 */
export interface EmporixAnonymousTokenResponse extends EmporixAccessTokenResponse, EmporixRefreshTokenResponse {
  session_id: string;
}

/**
 * Response type for customer token requests
 */
export interface EmporixCustomerTokenResponse extends EmporixAnonymousTokenResponse {
  saas_token: string;
}

/**
 * Optional session context parameters passed when creating a new anonymous token.
 * These pre-seed the Emporix session at token-creation time via
 * `GET /customerlogin/auth/anonymous/login?siteCode=…&currency=…&language=…&targetLocation=…`
 * (2026-04-21 Emporix Customer Service changelog — officially supported / GA).
 *
 * Pre-seeding avoids a follow-up `PATCH /me/context` from `adjustSessionsSettings`
 * when the shopper's preferred site/currency/language/country are already known
 * from cookies or headers (COP-5047 / COP-5055).
 *
 * `region` is kept on the type for internal symmetry with the other session
 * fields but is **not** a first-class anonymous-login query parameter; it is
 * written as a context attribute via `sessionService.updateContext` when
 * needed. `EmporixOAuthApi.getAnonymousToken` intentionally does not forward
 * `region` to the upstream request.
 *
 * @see https://developer.emporix.io/changelog/2026/2026-04-21-customer
 */
export interface AnonymousTokenSessionParams {
  siteCode?: string;
  currency?: string;
  language?: string;
  targetLocation?: string;
  region?: string;
}
