# Search Service Configuration

This document outlines how to configure which search service implementation is used in the Emporix Showcase application.

## Overview

The application supports two search service implementations:

1. **EmporixSearchService**: Uses the Emporix API for product search functionality
2. **BatteryIncludedSearchService**: Uses the Battery Included API for enhanced search capabilities

Both implementations conform to the `SearchService` interface, making them interchangeable within the application's dependency injection system.

## How to Switch Search Service Implementations

The active implementation is resolved through DI aliases from `src/platform/depency.yml` (and optional environment overrides), not by changing decorators in service classes.

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

### Option 3: Use environment variable override

You can override only the search alias via `.env` without editing `depency.yml`:

```env
DI_SEARCH_SERVICE=EmporixSearchService
# or
DI_SEARCH_SERVICE=BatteryIncludedSearchService
```

Supported values:
- `EmporixSearchService`
- `BatteryIncludedSearchService`

If `DI_SEARCH_SERVICE` is not set, the generator defaults to `EmporixSearchService`.

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

- Uses `BatteryIncludedShopApi` for product data
- Maps products using `BatteryIncludedProductMapper`
- Provides enhanced search capabilities including:
  - Faceted search with filters
  - Advanced suggestions
  - Product recommendations

## Important Notes

1. After changing alias configuration, run `npm run generate` to regenerate DI containers
2. Restart the application after regeneration
3. `SearchService` is consumed through DI in API/SSR paths, so no feature code changes are required

## Troubleshooting

If you encounter issues after switching implementations:

1. Verify the active alias in `src/platform/depency.yml` or `DI_SEARCH_SERVICE`
2. Ensure `npm run generate` was executed after config changes
3. Ensure the app was restarted
4. Check server logs for DI warnings about missing alias targets
