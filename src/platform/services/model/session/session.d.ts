/**
 * Represents a session context attribute in the service layer
 */
export interface SessionAttribute {
  key: string;
  value: any;
}

/**
 * Represents a session context in the service layer
 */
export interface Session {
  id: string;
  customerId?: string;
  currency: string;
  siteCode: string;
  language?: string;
  country?: string;
  region?: string;
  cartId?: string;
  legalEntityId?: string;
  attributes?: Record<string, SessionAttribute>;
  /** Optimistic-locking hint forwarded as `expectedVersion` to skip the pre-PATCH read. */
  metadata?: { version: number };
}
