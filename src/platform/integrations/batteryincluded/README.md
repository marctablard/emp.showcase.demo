# Battery Included Integration

This integration provides a client for interacting with the Battery Included API, which offers product search and discovery capabilities.

## Features

- Product browsing with search, filtering, and pagination
- Product suggestions based on search queries
- Highlighted products
- Product recommendations
- Presets for predefined searches

Presets are enforced at the adapter boundary only. There is no current SearchService consumer, so the visibility contract is applied in `BatteryIncludedShopApi` instead of a service-level preset method.

## Default Visibility Contract

Every BI request is scoped to published products only. The BFF applies two hard defaults on the server side before the request is serialized:

- `_product.published=true`
- `_product.categoryIds` restricted to the published root ids for the current site

The current site roots come from `CatalogPublishedRootCategoryService.getRootCategoryIdsForSite(site)`. The integration keeps the existing GET query-string contract and serializes the hard defaults as `f[_product.published]=true` plus repeated `f[_product.categoryIds][]=<rootId>` entries.

User filters can narrow the scope further, but they cannot widen it beyond the published roots. If the site has no published roots, the BFF fails closed and returns empty BI results or a null category-tree snapshot.

## Usage

### Configuration

The integration requires the following environment variables:

- `NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL`: Base URL for the Battery Included API

Battery Included runtime credentials and index selection are resolved on the server from the Emporix indexing public configuration provider `BATTERY_INCLUDED`:

- `GET /indexing/{tenant}/public/configurations/BATTERY_INCLUDED`
- `searchKey` is used as the BI API key
- `indexName` is used as the BI collection name

This keeps the storefront switchable after deploy by updating Emporix configuration instead of rebuilding with new BI key or collection env vars.

Runtime configuration is cached process-locally on the server for 60 seconds with in-flight request deduplication. This avoids reloading Emporix indexing config on every BI request while still allowing post-deploy key or collection changes to roll out shortly after the TTL expires.

## Category Tree Bootstrap

- The navigation-tree strategy is binding-driven: when the generated `SearchService` alias resolves to `BatteryIncludedSearchService`, SSR category loading uses the BatteryIncluded bootstrap path; when the alias resolves to Emporix, the existing Emporix category-tree path is preserved unchanged.
- The grounded BatteryIncluded bootstrap request is `/browse?q=&page=0&per_page=0&analyze=1&v[countryAware]=<country>&v[siteAware]=<site>&v[locale]=<locale>&f[_product.published]=true&f[_product.categoryIds][]=<rootId>...`.
- `_product_i18n.categoryBreadcrumbs.displayPath` is the primary category facet for BatteryIncluded navigation, and `counts[].data.idPath` is the primary ancestry/id source.
- Breadcrumb rows whose `idPath` does not contain any published Emporix catalog root id are pruned before the BI tree is built, because Emporix remains the publication authority for visible category roots.
- BatteryIncluded trees are cached process-locally by `siteCode + locale + countryBucket`; the preserved Emporix path keeps the existing `unstable_cache()` behavior.
- Internal UI selection stays id-based via ids derived from `idPath`; outbound BatteryIncluded navigation uses the breadcrumb facet value stored in typed category metadata.
