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

- Uses `BatteryIncludedShopApi` for product data
- Maps products using `BatteryIncludedProductMapper`
- Provides enhanced search capabilities including:
  - Faceted search with filters
  - Advanced suggestions
  - Product recommendations

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
