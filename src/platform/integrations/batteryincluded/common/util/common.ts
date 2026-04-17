import type { BatteryIncludedSearchParams } from '../../model';

/**
 * Builds search parameters for Battery Included API
 * @param params Search parameters
 * @returns URL search parameters string
 */
export function buildSearchParams<T>(params: BatteryIncludedSearchParams<T>): string {
  const queryParams = new URLSearchParams();

  // Add search query if provided
  if (params.query) {
    queryParams.append('q', params.query);
  }

  // Add pagination parameters
  if (!params.page) {
    params.page = 1;
  }
  queryParams.append('page', params.page.toString());
  // we need size to determine total page count
  if (!params.size) {
    params.size = 10;
  }
  queryParams.append('per_page', params.size.toString());

  // Add sort parameter
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }

  // Add locale parameter
  if (params.locale) {
    queryParams.append('v[locale]', params.locale);
  }

  // Add preset parameter
  if (params.preset) {
    queryParams.append('preset', params.preset);
  }

  // Add filters
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array values
        value.forEach((v) => {
          queryParams.append(`f[${key}][]`, v);
        });
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested filter objects like price ranges
        Object.entries(value).forEach(([subKey, subValue]) => {
          queryParams.append(`f[${key}][${subKey}]`, String(subValue));
        });
      } else {
        // Handle simple string values
        queryParams.append(`f[${key}]`, String(value));
      }
    });
  }

  return queryParams.toString();
}
