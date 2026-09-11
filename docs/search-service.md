# Search Service Configuration

This document outlines how to configure which search service implementation is used in the Emporix Showcase application.

## Overview

The application supports two search service implementations:

1. **EmporixSearchService**: Uses the Emporix API for product search functionality
2. **BatteryIncludedSearchService**: Uses the Battery Included API for enhanced search capabilities

Both implementations conform to the `SearchService` interface, making them interchangeable within the application's dependency injection system.

## How to Switch Search Service Implementations

The active implementation is resolved during DI generation through aliases from `src/platform/depency.yml` plus an optional build-time environment override. It is not selected at request time and it is not controlled by changing decorators in service classes.

### Option 1 (default): Use `EmporixSearchService`

Set the alias in `src/platform/depency.yml`:

```yml
Services:
  SearchService: EmporixSearchService
```

### Option 2: Use `BatteryIncludedSearchService`

Set the alias in `src/platform/depency.yml`:

```yml
Services:
  SearchService: BatteryIncludedSearchService
```

### Option 3: Use build-time environment variable override

You can override only the search alias via the environment seen by the build that runs `npm run generate` without editing `depency.yml`:

```env
DI_SEARCH_SERVICE=EmporixSearchService
# or
DI_SEARCH_SERVICE=BatteryIncludedSearchService
```

Supported values:
- `EmporixSearchService`
- `BatteryIncludedSearchService`

If `DI_SEARCH_SERVICE` is not set, `SearchService` falls back to the alias resolved from the dependency alias source in use. In the default repository setup, that is typically `src/platform/depency.yml`.

### Environment-specific alias files

You can also select a complete alias file:

```env
# uses src/platform/depency.<DI_ENV>.yml
DI_ENV=production

# explicit path (absolute or relative to repo root)
DI_DEPENDENCY_FILE=src/platform/depency.local.yml
```

## Implementation Differences

### EmporixSearchService

- Uses `EmporixProductApi` for product data
- Maps products using `EmporixProductMapper`
- Provides basic search functionality
- Currently has placeholder implementations for highlights and recommendations

### BatteryIncludedSearchService

- Uses `BatteryIncludedProductMapper` and BI-specific search facets
- Faceted search with filters
- Always exposes the guaranteed sort options for product name and price, then appends any valid BI response-driven sort facets without duplicate ids.
- Advanced suggestions
- Product recommendations
- Resolves request-scoped visibility explicitly and threads it through search, suggestions, highlights, recommendations, presets, and category-tree bootstrap so unpublished catalogs cannot leak into results.
- Applies the BI hard defaults on every query: `_product.published=true` and `_product.categoryIds` constrained to the published root ids returned by `CatalogPublishedRootCategoryService.getRootCategoryIdsForSite(site)`.
- Keeps the filter transport on the existing BI GET query contract; the default scope is serialized as `f[_product.published]=true` and repeated `f[_product.categoryIds][]=<rootId>` entries.
- Merges user-selected filters by intersection, so callers can narrow scope but cannot broaden it beyond the published roots.
- Fails closed only when the site has no published roots, returning empty BI results or a null category-tree bootstrap snapshot.

### BatteryIncluded visibility contract

BatteryIncluded search calls do not rely on hidden request state. The service layer resolves the visibility variables once per request, resolves the published root ids once per request, and passes both into the BI adapter as explicit visibility metadata. That keeps the scope policy in the service layer and the shop API layer as a stateless serializer.

When the BI search request includes same-field category selection, the service narrows it to the published roots before the request is sent upstream. That preserves pagination and total counts without any client-side post-filtering.

## Browse initial search

Public and authenticated browse pages seed `initialSearch` with `createBrowseInitialSearch(rawParams, site, locale, scope?)` in `src/lib/search/create-browse-initial-search.ts`. The helper copies URL `q`, `page`, `size`, `filters`, and `sort` (first string when the query is an array; omitted when absent) so a shared or refreshed `?sort=` URL starts with the same sort token the client later reads.

The optional `scope` (`{ segmentIds, allowedCategoryIds }`) is passed only in `assigned` products mode (see below). It is resolved server-side from `getProductsModeContext` + `getSegmentCategoryScope`, never from the URL; when present, `filters.categoryIds` is sanitised against `allowedCategoryIds` and `segmentIds` is added to `initialSearch`.

## Customer segments & products mode (COP-4822)

Customers assigned to Emporix customer segments see only the segment assortment ("Assigned Products") in header, footer, PLP, search suggestions and PDP. The mode is decided on the server for every request; the client can never widen it.

### Mode resolution

`ProductsModeService` (`src/platform/services/products-mode/ProductsModeService.d.ts`, default implementation `impl/DefaultProductsModeService.ts`) is the single authority. `resolve({ optInCookieValue, siteCode })` returns a `ProductsModeContext` with `mode`, `segmentIds`, `canToggleAllProducts`, `engine`, `siteCode` and `customerId`.

| Mode | When | Catalog |
| --- | --- | --- |
| `anonymous` | No logged-in customer | Full catalog (unchanged behaviour) |
| `unsegmented` | Customer without active segments for the site | Full catalog (unchanged behaviour) |
| `assigned` | Segmented customer (default) | Segment assortment only |
| `all` | Segmented customer who opted in | Full catalog — behaves exactly like `anonymous` / `unsegmented` everywhere (search, PDP, site-wide header/footer forest, "All Products" labels); requires `canToggleAllProducts`, which keeps the toggle visible so the customer can switch back |

Rules:

- `canToggleAllProducts = NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE === 'true' && segmented` (see [Environment Variables](./environment-variables.md#next_public_allow_segments_override-optional-public)). ALL PRODUCTS MODE is engine-agnostic: it is available with both `BatteryIncludedSearchService` and `EmporixSearchService`. The routes and SSR helpers forward `segmentIds` only in `assigned` mode, so `all` reaches the services exactly like an unsegmented request; neither engine special-cases it.
- **Hard rule:** the opt-in lives in the httpOnly session cookie `next-products-mode` (`src/lib/common/products-mode-cookie.ts`). Its value is bound to the customer id (`all.<customerId>`), so a stale cookie from another user is ignored. It is written or cleared only by `PUT /api/customer-segment/products-mode` (`{ mode: 'all' | 'assigned' }`, optional `?site=`, client helper `setProductsMode(mode, siteCode)` in `src/lib/client/customer-segment.ts`) after the server re-validated `canToggleAllProducts`; otherwise the route answers `403 ALL_PRODUCTS_MODE_NOT_ALLOWED` and deletes the cookie. Query params, request bodies and localStorage are never consulted for the mode.
- **Site rule:** the request `siteCode` is trimmed; when blank the validated session site is used (the same source `EmporixProductService` uses for prices). Segments are site-bound, so an authenticated customer without any usable site is resolved as `assigned` with `segmentIds: []` and a `warn` log instead of an unscoped catalog (fail closed). Anonymous sessions need no site.
- **Fail closed:** when the segment lookup rejects, the customer is resolved as `assigned` with `segmentIds: []`. The services distinguish `segmentIds === undefined` (unscoped — `anonymous` / `unsegmented`, the routes and SSR helpers pass no `segmentIds` at all) from an array (scoped) and treat `[]` as an **empty scope**: `searchProducts`, `getSuggestions`, `getCatalogProductById`, `getProductById` and `getVariantProducts` return an empty result / not found on both engines without any upstream call, so no out-of-segment product is exposed during an outage. An empty segment list from a successful lookup is `unsegmented`.

### Segment lookup (`getMySegments()`)

`EmporixCustomerSegmentService.getMySegments()` first calls `GET /customer-segment/{tenant}/me/segments` (backend COP-5908). The integration treats the answer as usable only when it is a JSON array; a non-ok status, missing JSON `content-type`, empty body, or an array whose entries carry no string `id` (shape drift) makes it fall back to `GET /customer-segment/{tenant}/segments` (`segment_read_own`, page size 100, paged with `pageNumber` and `X-Total-Count`) with a `warn` log (`me/segments unavailable; falling back to GET /segments`). The same shape-drift check is applied to the fallback payload: a non-empty page with no string ids is thrown so `ProductsModeService` fails closed (`assigned` / `segmentIds: []`) instead of granting the unsegmented catalog. Results are then filtered to segments of the requested `siteCode` within their validity window; a segment is dropped only when it carries an explicit non-`ACTIVE` status — an absent `status` (or an unparsable validity bound) keeps the segment, because dropping segments would widen the catalog (fail closed).

At implementation time the api-develop probe of `me/segments` returned `HTTP 200` with an empty body and no `content-type` (identical to an unknown `me/*` route), so the `GET /segments` fallback is what actually serves customers today. Once COP-5908 responds with a JSON array the primary path takes over without a code change.

Scopes are provided by `SegmentFilterService` (`src/platform/services/search/impl/SegmentFilterService.ts`). Every scope takes the active `segmentIds` of the resolved `ProductsModeContext` so that assignments of unrelated segments (inactive, expired, another site) never widen it; an empty `segmentIds` list is an empty scope without any upstream call (fail closed):

- `getCategoryScope(siteCode, segmentIds)` — `GET /segments/items/category-trees` → published segment forest (`roots`), `treeCategoryIds`, `assignedCategoryIds` (passed unexpanded to Emporix) and `allowedCategoryIds` (tree ∪ self + descendants of assigned nodes). The category-trees nodes carry no segment id (`isSegmentAssigned` only); the endpoint is bound to the customer token and filtered by the backend to the customer's active segments for the given `siteCode`, so its forest is used as returned.
- **Product-assigned categories in the forest.** A product assigned directly to a segment carries the segment id itself, but its category is *not* assigned and therefore not returned by `category-trees`. So the header/footer forest and the PLP "Categories" tree still show e.g. `Home > Tiles` for four directly assigned tiles, `getCategoryScope` additionally resolves the product scope and looks up the categories of every directly assigned product through the Category Service `GET /category/{tenant}/assignments/references/{productId}?expandSupercategoriesIds=true` (`EmporixCategoryApi.getCategoriesByReferenceId`, public token, cached with `DEFAULT_CACHE_REVALIDATE`, 404 → none). The response carries ancestor **ids** only (`supercategoriesIds`), so each category is grafted into `roots` with the full ancestor path taken from the site's published navigation trees (`CategoryService.getNavigationCategoryTrees(siteCode, false)`); categories that are unpublished or outside those trees are skipped. Grafted nodes are plain path nodes — no subtree, **not** `assignedToSegment`: they join `treeCategoryIds` / `allowedCategoryIds` (so `filters[categoryIds]=<id>` passes the AC5 sanitiser and the BI tree count for the node works through the `displayPath` facet) but never `assignedCategoryIds`, so the Emporix `categoryIds:(…)` scope and `filterProductIdsInScope` stay limited to the directly assigned products. The lookups are deduped, run 8 at a time and capped at `PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS` (200) products with a `warn` when truncated; a failing lookup (per product or the product-items call itself) is logged at `warn` and skipped — it only affects tree visibility, never the product scope.
- `getProductScope(siteCode, segmentIds)` — `GET /segments/items?q=type:PRODUCT segmentId:(s1,s2)` (standard q-param on the raw `type` / `segmentId` fields, paged, `X-Total-Count`) → directly assigned product ids. The items are additionally kept only when `item.segmentId ∈ segmentIds`, so an upstream that ignores the filter cannot widen the scope.
- `filterProductIdsInScope(ids, siteCode, segmentIds)` — engine-agnostic membership check used by the Emporix PDP and by variants on both engines (`ProductService.getVariantProducts(id, { segmentIds, siteCode })`). The **effective site** is the one the mode was resolved for: `ProductFetchOptions.siteCode` is set by the routes / PDP together with `segmentIds` (`ctx.siteCode ?? request site`), `EmporixProductService` falls back to the session site only when it is absent and fails closed (empty membership, `warn`) without any usable site.

### Engine scoping

| Bound implementation | How the segment scope reaches the engine |
| --- | --- |
| `BatteryIncludedSearchService` | `applyCustomerSegmentFilters` adds `segmentIds` to the filters, serialised as repeated `f[_product_siteAware.segmentIds][]=<id>` entries on search, suggestions and the PDP lookup (`getCatalogProductById`). The `_product_siteAware.segmentIds` facet is dropped from the response. An out-of-segment product is a BI miss → 404. |
| `EmporixSearchService` | `buildSegmentScopeCompoundQuery` (`src/platform/integrations/emporix/product/buildProductCatalogScopeQ.ts`) appends one verbatim fragment to `q`: `compoundLogicalQuery:((categoryIds:(a,b)) OR (id:(p1,p2)))`, or `((categoryIds:(sel)) AND (…))` when a sanitised category filter is selected. Id lists are unquoted `(a,b)`. It replaces the root `categoryIds` scoping, is applied **before and regardless of** `isUnscopedProductSearch` (`searchAllProducts` / `NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER` never bypass it) and does no post-filtering, so paging and totals stay correct. An empty scope returns no results. PDP membership uses `filterProductIdsInScope`. |

### Route and SSR contract

- `GET /api/search`, `GET /api/search/suggestions`, `GET /api/products/[id]` and `GET /api/products/[id]/variants` re-derive the mode from `ProductsModeService` (session + cookie) and ignore any client-supplied `segmentIds`. In `assigned` mode they pass `ctx.segmentIds` to the service (and, for the product routes, `siteCode: ctx.siteCode ?? request site` so membership uses the same site as the mode). `GET /api/products/[id]` also passes that effective site as `getCatalogProductById`'s 4th argument (BatteryIncluded resolves the browse site there, not from `options.siteCode`). `/api/search` loads `getCategoryScope` for the AC5 allow-list **only when** `filters.categoryIds` is present (BatteryIncluded search does not use that Emporix scope) and forces `searchAllProducts=false`. Emporix assigned search reuses one `getProductScope` lookup for both the compound `id:(…)` clause and category-forest grafting.
- `GET /api/search/recommendations/[id]` (CMS "recommendations" carousel) is mode-aware too: in `assigned` mode it passes `{ segmentIds }` as `getRecommendations` options — `BatteryIncludedSearchService` applies them natively as `f[_product_siteAware.segmentIds][]` on the BI `/recommendations` endpoint (same `f[...]` visibility filters as `/browse`), `[]` returns `[]` without a BI call, and the Emporix stub keeps returning `[]`. Responses in `assigned` / `all` mode (including errors) are `Cache-Control: private, no-store`.
- **AC5 filter sanitising:** `sanitizeCategoryFilters(filters, allowedCategoryIds)` (`src/lib/search/sanitize-category-filters.ts`) keeps only `filters.categoryIds` values inside `SegmentCategoryScope.allowedCategoryIds`; out-of-scope ids are dropped, never widened. Applied in `/api/search` and in `createBrowseInitialSearch`. Without a resolvable site the allow-list is empty (fail closed).
- **Per-request caching rule:** `src/lib/ssr/products-mode.ts` wraps `getProductsModeContext(siteCode)` and `getSegmentCategoryScope(siteCode, segmentIds)` (keyed by site + a sorted, de-duplicated serialisation of the ids, so callers dedupe regardless of array identity) in React `cache()` so `(nav-shell)/layout.tsx`, `browse/page.tsx` and `product/[id]/page.tsx` resolve the mode once per render pass. Personalised data uses no Next.js data cache and no module-level state; nothing is shared across requests. `getNavigationCategoryTreesForMode` returns the segment forest (`getSegmentNavigationRoots`) in `assigned` mode only and the site-wide navigation trees otherwise (`anonymous`, `unsegmented` and the `all` opt-out); `isSegmentedMode(ctx)` is likewise `true` only for `assigned`.
- **Segment forest on BatteryIncluded:** `SegmentCategoryScope.roots` come from the Emporix category-trees and carry no BI metadata, so `getSegmentNavigationRoots(siteCode, locale, segmentIds)` enriches them per request with the BI category metadata (`displayPath`, `facetValue`, `labelPath`, `idPath`, …) of the public category snapshot (`getCachedBatteryIncludedCategorySnapshot`, keyed by category id; `enrichCategoriesWithBatteryIncludedMetadata` in `src/lib/category/`). Hrefs, selected-category resolution and the PLP tree counts then use the segment-scoped `_product_i18n.categoryBreadcrumbs.displayPath` facet exactly like the public PLP; the snapshot's public `count` is deliberately not copied. Nodes missing from the snapshot (and every node when the snapshot is unavailable or the engine is Emporix) keep working through `filters[categoryIds]` links and the Emporix per-category counts. `scope.roots` itself stays un-enriched; AC5 sanitising keeps using `scope.allowedCategoryIds`.
- **HTTP caching (fail closed):** responses in `assigned` or `all` mode are sent with `Cache-Control: private, no-store`; `anonymous` / `unsegmented` responses keep their previous headers. Every mode-aware route starts private and relaxes the header only once the mode is known to be `anonymous` / `unsegmented`, so a `500` produced while resolving the mode is never cacheable (`/api/products/[id]`, `/api/products/[id]/variants`, `/api/search`, `/api/search/suggestions`, `/api/search/recommendations/[id]`). `PUT /api/customer-segment/products-mode` is always `private, no-store`. Additionally, the [cache middleware](./cache-middleware.md#authenticated-requests-bypass) never marks a response `public` when an Auth.js session cookie is present.

### UI surfaces

- Header and footer show "Assigned Products" (`layout.header.assignedProducts`, `layout.footerLinks.assignedProducts`) with the segment forest as category menu in `assigned` mode only; in `all` mode they show "All Products" with the site-wide forest, exactly like an anonymous customer.
- The PLP heading (`browseHeadingKey` in `src/lib/search/browse-heading-key.ts`) is the search-results heading (`search.searchResults.searchResults`) whenever a search phrase `q` is present, in every mode; without a phrase it is "Assigned Products" (`search.searchResults.assignedProducts`) in `assigned` mode and "All Products" (`search.searchResults.allProducts`) otherwise.
- The ASSIGNED / ALL products segmented control (`PlpProductsModeSwitch`, same visual pattern as `CompanyScopeToggle`) is a radiogroup (`data-testid="plp-productsModeSwitch"`, `aria-label` `productsModeSwitchLabel`) with both options always visible: `plp-productsModeAssigned` / `plp-productsModeAll` (`search.searchResults.assignedProductsShort` / `allProductsShort` — "Assigned" / "All"). The selected option also carries `plp-productsModeLabel`. It lives in the PLP "Categories" card header (`PlpCategoryTree`) and above the nested tree in the mobile category drawer (list layout, BatteryIncluded). In the `grid` layout (Emporix engine, no category tree card) `SearchResultsComponent` mounts it once as its own row directly above the Filter + Sort toolbar, before the filters, for every breakpoint. It is rendered only when `canToggleAllProducts` is true; toggling calls `setProductsMode('all' | 'assigned', siteCode)` (`PUT /api/customer-segment/products-mode?site=`) and then `router.refresh()` so the server re-resolves the mode (category tree, header/footer labels and results).
- In `assigned` mode the PLP "Categories" tree (`PlpListLayout`) and the mobile category drawer (`MobileCategoryDrawer`) show only the segment-scoped counts of the live `categoryBreadcrumbs` facet (`resolvePlpCategoryTreeFacetContext`); the public, CDN-cached and unscoped `GET /api/categories/{id}/product-count` (`useCategoryProductCounts`) is never called there, so rows render without a number until the facet arrives instead of flashing site-wide counts first. `anonymous`, `unsegmented` and `all` keep requesting the per-category counts as before. The same gate applies to `PlpCategoryCarousel`. Sibling order in that tree (and the static `resolvePlpCategoryContext` fallback) is `compareByPosition`: defined non-zero `position` ascending, then `position === 0`, then missing `position`. Live BI facet options are typically count-descending and must be re-sorted; counts stay on the row but do not drive order.
- `ProductsModeSessionSync` (`src/components/navigation/products-mode-session-sync.tsx`, mounted inside `ProductsModeProvider` by the nav-shell layout) calls `router.refresh()` once per pathname when the NextAuth session disagrees with the server-seeded mode **or customer id** (authenticated + `anonymous`, unauthenticated + personalised, or a different `user.id` than the seeded `customerId`), so a login through the `/login` dialog, an account switch, or an expired session updates the mode and the category trees without a manual reload.
- Mode-sensitive client fetches (`fetchProductById`, `fetchProductVariants`, `fetchSearchResult`, `fetchRecommendations`) coalesce in-flight requests with a `mode:site:customer` scope (`buildClientFetchScope`) so a login, logout, or ASSIGNED ⇄ ALL transition never reuses the previous scope's promise.
- The header search fly-out re-validates the "last seen" products against `/api/products/[id]` in `assigned` mode (`useModeScopedLastSeen`, `src/hooks/history/useModeScopedLastSeen.ts`): the `HistoryStore` persists full `Product` objects, so only the ids that still resolve are rendered (404 → hidden, list hidden while pending, cached per `[mode, ids]` and cleared when the mode leaves `assigned`); every other mode renders the cached items without a request.

## PDP catalog identity

H1, last breadcrumb crumb, document title, Open Graph, and JSON-LD share the catalog product loaded through `SearchService.getCatalogProductById`. The PDP SSR helper `getProductById` in `src/lib/ssr/products.ts` and `GET /api/products/[id]` both call that method. Cart and wishlist services keep using `ProductService.getProductById` (Emporix Product GET).

| Bound implementation | Identity / copy |
| --- | --- |
| `BatteryIncludedSearchService` | Visibility-scoped BI browse by URL id (`f[_product.id]`, then one retry with `f[id]`). Mapped like PLP. A miss is not a Product GET fallback — the method returns `undefined` and PDP calls `notFound()`. |
| `EmporixSearchService` | Full Emporix Product GET via `ProductService.getProductById`. |

For Battery Included, `BatteryIncludedProductMapper` sets `Product.name` from `_product_i18n` when any i18n name exists — not from `_product.name`:

| Hit shape | Name source |
| --- | --- |
| Flattened | `_product_i18n.name` |
| Locale-map | `_product_i18n.<lang>.name` collected into a localized map |

`_product.name` is used only when no i18n name is present.

H1, the last visible breadcrumb crumb (`generateVisibleBreadcrumbForPdp`), and `getProductName` (document title, Open Graph, JSON-LD) resolve that catalog name with `resolveCatalogDisplayName` in `src/lib/product/resolve-catalog-display-name.ts`: request locale, then `site.defaultLanguage`, then `routingConfig.defaultLocale`.

Omitted BI mixins stay empty (specs and highlights are not filled from Product GET). Commerce — price, stock, and variants — stays on Emporix (Price Service, Availability Service, Product API).

## PDP Breadcrumb Strategy

PDP breadcrumbs are **always-on**: whenever product data resolves, `UiBreadcrumb` renders on cold start and client navigation. Composition is **independent of** `NEXT_SSR_PRODUCT` / `isProductSsrEnabled()` — that flag may still gate ProductDetail enrichment (prices, variants, stock) and JSON-LD, but it does **not** gate breadcrumbs.

Breadcrumbs show the **full category-tree ancestry** from the publication-/navigation-rooted trail to the leaf category assigned to the product, then the product name as the last (unclickable) crumb, taken from the catalog identity product (see [PDP catalog identity](#pdp-catalog-identity)). `UiBreadcrumb` always prepends the translated storefront Home link. Labels come from the live nav category tree (node names / BI `labelPath`) for the tenant — illustrative shapes such as `Home > All Products > Home > Furniture > …` are depth/shape guidance only and must **not** be hard-coded.

### Primary ancestry (flyout / nav category tree)

The same forest as the header flyout drives the primary trail:

1. Load the catalog product through `SearchService.getCatalogProductById` (SSR helper `getProductById`) — engine behavior is in [PDP catalog identity](#pdp-catalog-identity). `categoryIds` / optional `primaryCategory` are available without full category enrichment.
2. Load `getCachedNavigationCategoryTrees(site, locale)` (React `cache()` dedupes with `(nav-shell)/layout.tsx` in the same request).
3. Among product category candidates (`primaryCategory?.id`, `categoryIds`, `categories[].id`), pick the **deepest** path via `findDeepestCategoryPath` / `findCategoryPath`.
4. Build crumbs with `generateVisibleBreadcrumbForPdp` (navigation roots / path first).

### Dual-engine browse hrefs (BI-safe)

Href selection is driven by BI metadata on nav path nodes, not by inventing filter params per page:

| Path metadata | Browse href contract |
| --- | --- |
| **BatteryIncluded** (`source === 'batteryincluded'`) | Prefer the leaf node's `displayPath` (when present) and emit **cumulative** levels via `buildBrowseHrefForBreadcrumbDisplayPath`. When a node has BI metadata with `labelPath` but missing `displayPath` / `facetValue`, use `buildBrowseHrefForBreadcrumbDisplayPath(meta.displayPath ?? meta.labelPath)`. **Never** emit `filters[categoryIds]` while BI metadata is present. Field: `filters[_product_i18n.categoryBreadcrumbs.displayPath]=…` |
| **Emporix / no BI metadata** | `filters[categoryIds]=…` via `buildBrowseHrefForCategoryId` |

Do **not** call `buildBrowseHrefForCategoryId` alone as the BI primary path — ancestor BI nodes may lack `displayPath`/`facetValue` while still having cumulative `labelPath`, and that helper would incorrectly fall through to `categoryIds` under BI.

### Secondary fallbacks

When none of the product category ids exist in the nav forest:

1. **BI snapshot** — deepest match in `getCachedBatteryIncludedCategorySnapshot` (`byId`, longest `idPath` / `displayPath` levels), then cumulative displayPath crumbs.
2. **Emporix `/parents`** — ordered root→leaf trail from `CategoryService.getCategoryParents` via `getCategoryAncestorTrail` (`emporixAncestorTrail`). Legacy enriched `.parent` walk is last resort when no trail is provided.
3. **Product-only** — `Home > product` (Home from `UiBreadcrumb`) — an **accepted exception** when ancestry cannot be resolved, not a Full Flow regression when the nav forest (and secondary sources) miss.

The builder never invents category labels or reconstructs BI `displayPath` from Emporix names. `getActiveSearchEngine` remains useful for optional engine-aware fallback selection; primary dual-engine hrefs come from Category metadata on nav nodes.

**SEO decoupling:** Visible crumbs use `generateVisibleBreadcrumbForPdp`. JSON-LD / SEO continues to use `generateBreadcrumbForProduct` and is intentionally not aligned with the visible nav/BI trail in this work.

**Limitations** (out of scope for this feature):

- The existing `Back` link on `UiBreadcrumb` preserves current component behavior and does **not** represent browser-history navigation.

## Important Notes

1. `DI_SEARCH_SERVICE` is a build-time override. Changing it requires regeneration and a rebuild or redeploy.
2. The authoritative `DI_SEARCH_SERVICE` value is the one present in the target build environment that runs `npm run generate`.
3. After changing alias configuration, run `npm run generate` to regenerate DI containers.
4. Restart the application after regeneration for local development, or trigger a new deployment in hosted environments.
5. `SearchService` is consumed through DI in API/SSR paths, so no feature code changes are required.

## Troubleshooting

If you encounter issues after switching implementations:

1. Verify the active alias in `src/platform/depency.yml` or `DI_SEARCH_SERVICE`
2. Ensure `npm run generate` was executed after config changes
3. Ensure the app was restarted locally or rebuilt remotely after the config change
4. Check server logs for DI warnings about missing alias targets

## Related Documentation

- [Documentation index](./README.md)
- [Dependency Injection](./dependency-injection.md)
- [Environment Variables](./environment-variables.md)
- [Layered Architecture](./layered-architecture.md)
