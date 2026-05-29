import type { ComponentType, HTMLAttributes } from 'react';
import type {
  CMSComponent,
  CMSLayout,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
  WebhookEvent,
  WebhookResult,
} from '../model/cms';

/**
 * Plugin SPI for CMS providers (Storyblok, local-JSON, none, ...).
 *
 * Implementations are bound via DI with id `CmsAdapter:<provider-id>`. The
 * active adapter is alias-bound to `CmsAdapter` by `CmsProviderResolver`
 * at bootstrap. `DelegatingCmsServiceSSR` delegates `CMSService`-calls to
 * it.
 *
 * The required surface is intentionally small: identity, presence check,
 * page + navigation accessors. Accessor methods never reject for missing
 * content — they surface "no result" as `{ notfound: true }` instead.
 *
 * Optional surface (`getEditableProps`, `BridgeScript`) is reserved for
 * provider-side editing concerns (e.g. Storyblok Visual Editor). When an
 * adapter omits it, the `DelegatingCmsServiceSSR` facade falls back to
 * sensible defaults (`{}` / `null`).
 */
export interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  /**
   * `site` is a hint, not a directive. Adapters may use it (Storyblok prefixes
   * the slug with it for multi-site spaces), or override it from a more
   * authoritative source (LocalJsonCmsAdapter consults `SessionService`).
   * Adapters MUST NOT reject when the hint disagrees with their authoritative
   * source — they pick the right one and continue.
   */
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  /**
   * Resolves the layout frame `layoutId` renders into. Like `getPage`, the
   * `site` is a hint, not a directive, and the method never rejects for a
   * missing layout — it surfaces "no result" as `{ notfound: true }`. The
   * page shell falls back to rendering the page body directly when the
   * active adapter has no layout for the id.
   */
  getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** Optional. Plain DOM attributes, NO wrapper tag. */
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  /** Optional. Mounted once in the layout. */
  BridgeScript?: ComponentType;

  /**
   * Optional webhook surface. A provider that pushes content-change
   * notifications (Storyblok) implements `validateWebhookSignature` +
   * `mapWebhookPayload`; the `DelegatingCmsServiceSSR` facade then
   * orchestrates the default flow (verify → parse → map → invalidate). An
   * adapter MAY instead provide `handleWebhook` to own the whole request; the
   * facade prefers it when present. An adapter that implements none of these
   * has no webhook endpoint — the route answers `405`.
   *
   * Security: `validateWebhookSignature` MUST be constant-time
   * (`crypto.timingSafeEqual` with an explicit length guard) and MUST NOT
   * fall back to a naive `===` comparison. The signing secret is read from
   * the server-only `NEXT_CMS_WEBHOOK_SECRET`.
   */
  handleWebhook?(request: Request): Promise<WebhookResult>;
  /** Optional. `true` iff the request carries a valid HMAC signature. Constant-time. */
  validateWebhookSignature?(headers: Headers, rawBody: string): boolean;
  /** Optional. Translate a provider webhook payload into granular invalidation events. */
  mapWebhookPayload?(headers: Headers, body: unknown): WebhookEvent[] | null;
}
