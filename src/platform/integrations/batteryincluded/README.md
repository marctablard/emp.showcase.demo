# Battery Included Integration

This integration provides a client for interacting with the Battery Included API, which offers product search and discovery capabilities.

## Features

- Product browsing with search, filtering, and pagination
- Product suggestions based on search queries
- Highlighted products
- Product recommendations
- Presets for predefined searches

## Usage

### Configuration

The integration requires the following environment variables:

- `NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL`: Base URL for the Battery Included API
- `NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY`: API Key for authentication
- `NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION`: Collection name to use for queries

## Category Tree Bootstrap

- The navigation-tree strategy is binding-driven: when the generated `SearchService` alias resolves to `BatteryIncludedSearchService`, SSR category loading uses the BatteryIncluded bootstrap path; when the alias resolves to Emporix, the existing Emporix category-tree path is preserved unchanged.
- The grounded BatteryIncluded bootstrap request is `/browse?q=&page=0&per_page=0&analyze=1&v[countryAware]=<country>&v[siteAware]=<site>&v[locale]=<locale>`.
- `_product_i18n.categories.breadcrumbs.displayPath` is the primary category facet for BatteryIncluded navigation, and `counts[].data.idPath` is the primary ancestry/id source.
- Breadcrumb rows whose `idPath` does not contain any published Emporix catalog root id are pruned before the BI tree is built, because Emporix remains the publication authority for visible category roots.
- BatteryIncluded trees are cached process-locally by `siteCode + locale + countryBucket`; the preserved Emporix path keeps the existing `unstable_cache()` behavior.
- Internal UI selection stays id-based via ids derived from `idPath`; outbound BatteryIncluded navigation uses the breadcrumb facet value stored in typed category metadata.
