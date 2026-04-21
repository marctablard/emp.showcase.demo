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
 * These pre-seed the Emporix session so that `adjustSessionsSettings` doesn't need
 * to fire a PATCH call afterwards (COP-5047 / COP-5055).
 */
export interface AnonymousTokenSessionParams {
  siteCode?: string;
  currency?: string;
  language?: string;
  targetLocation?: string;
  region?: string;
}
