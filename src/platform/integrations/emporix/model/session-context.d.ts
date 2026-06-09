import type { EmporixMetadata } from './common';

export interface EmporixSessionContext {
  sessionId: string;
  customerId?: string;
  siteCode?: string;
  currency?: string;
  cartId?: string;
  targetLocation?: string;
  /**
   * Top-level shopper language (IETF BCP 47 code such as `en`, `de`, `fr`).
   *
   * Promoted to a first-class session-context field by the 2026-04-21 Emporix
   * Session Context changelog. Older sessions still carry the value under
   * `context.language`; prefer reading the top-level field and fall back to
   * `context.language` for backwards compatibility.
   *
   * @see https://developer.emporix.io/changelog/2026/2026-04-21-session-context
   */
  language?: string;
  context?: Record<string, any>;
  metadata?: EmporixMetadata;
}

export interface EmporixContextAttribute {
  key: string;
  value: string | Record<string, any>;
}
