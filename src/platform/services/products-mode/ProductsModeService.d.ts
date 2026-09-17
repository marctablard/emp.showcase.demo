/**
 * Storefront products mode of the current request (COP-4822).
 * - `anonymous`: no logged-in customer.
 * - `unsegmented`: logged-in customer without active segments (full catalog, today's behaviour).
 * - `assigned`: segmented customer restricted to the segment assortment (default for segmented customers).
 * - `all`: segmented customer who opted into the full catalog (flag-gated, any search engine);
 *   behaves exactly like an anonymous / unsegmented customer for catalog scoping.
 */
export type ProductsMode = 'anonymous' | 'unsegmented' | 'assigned' | 'all';

export type SearchEngineKind = 'batteryincluded' | 'emporix';

export interface ProductsModeContext {
  mode: ProductsMode;
  /**
   * Active segment ids for `siteCode`; [] unless mode is 'assigned' | 'all' (also [] for 'assigned'
   * after a failed lookup = fail closed). Consumers forward it to the services only in 'assigned'
   * mode, where `[]` is an empty scope (no results) — never pass it for other modes. In 'all' mode
   * it is informational only: the request is treated exactly like an unsegmented one.
   */
  segmentIds: string[];
  /** `NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE === 'true'` AND segmented — engine-agnostic (AC3a). */
  canToggleAllProducts: boolean;
  engine: SearchEngineKind;
  /**
   * Site the segments were filtered for (trimmed input `siteCode`, else the session site). Consumers
   * pass it on as the effective site for scope / membership lookups. `undefined` only for
   * `anonymous` or for the fail-closed `assigned` / `[]` result when no usable site exists.
   */
  siteCode?: string;
  customerId?: string;
}

export interface ProductsModeResolveInput {
  /** Raw value of the `next-products-mode` cookie, read by the caller (route / SSR helper). */
  optInCookieValue?: string;
  /**
   * Site to filter segments for; trimmed, a blank value falls back to the session site. An
   * authenticated customer without any usable site resolves fail closed (`assigned`, `[]`).
   */
  siteCode?: string;
}

/**
 * Single server-side authority for the products mode. Every personalised surface
 * (routes, SSR pages, navigation) consumes its result instead of deriving identity,
 * segments or the flag itself.
 */
export interface ProductsModeService {
  resolve(input: ProductsModeResolveInput): Promise<ProductsModeContext>;
}
