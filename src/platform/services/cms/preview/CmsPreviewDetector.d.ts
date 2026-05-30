/**
 * Edge-safe detection half of the CMS preview SPI (EMP-15 §1, Interface
 * Segregation).
 *
 * A `CmsPreviewDetector` answers a single, purely synchronous question: "is
 * this URL a genuine provider preview request?" It does NO I/O, returns NO
 * Promise, reads NO `process.env` (env is read only by the registry factory),
 * imports NO `@storyblok/*` SDK, and is NOT `server-only`. That keeps it
 * legal to evaluate from the Edge middleware bundle.
 */
export interface CmsPreviewDetector {
  /** Provider id this detector speaks for (e.g. `'storyblok'`, `'none'`). */
  readonly id: string;
  /** Synchronous, side-effect-free preview decision over the request URL. */
  isPreviewRequest(url: URL): boolean;
}
