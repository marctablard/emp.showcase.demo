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

Public and authenticated browse pages seed `initialSearch` with `createBrowseInitialSearch` in `src/lib/search/create-browse-initial-search.ts`. The helper copies URL `q`, `page`, `size`, `filters`, and `sort` (first string when the query is an array; omitted when absent) so a shared or refreshed `?sort=` URL starts with the same sort token the client later reads.

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
