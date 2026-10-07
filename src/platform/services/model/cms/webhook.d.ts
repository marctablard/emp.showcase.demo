/**
 * CMS webhook domain model.
 *
 * Provider-agnostic description of "something in the CMS changed". A provider
 * adapter (`CmsAdapter.mapWebhookPayload`) translates its own wire-format
 * webhook into a flat list of these events; the service facade
 * (`DelegatingCmsServiceSSR`) consumes them to invalidate the affected cache
 * keys. Nothing downstream of `mapWebhookPayload` knows which CMS produced the
 * event — the shape below is the seam.
 *
 * Granularity mirrors the cache key dimensions: a page is addressed by
 * `slug`/`locale`/`site`, a layout by `layoutId`/`locale`/`site`. `navigation`
 * carries no per-item id because navigation is fetched wholesale per
 * `locale`/`site`.
 */
export type WebhookEvent =
  | { kind: 'page'; slug: string; locale: string; site: string }
  | { kind: 'layout'; layoutId: string; locale: string; site: string }
  | { kind: 'navigation'; locale: string; site: string };

/**
 * Result of handling a CMS webhook request. Passed through verbatim by the
 * `POST /api/cms/webhook` route handler: `status` becomes the HTTP status and
 * `body` (when present) the JSON body.
 */
export interface WebhookResult {
  status: number;
  body?: unknown;
}
