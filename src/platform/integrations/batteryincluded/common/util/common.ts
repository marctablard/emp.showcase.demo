import type { BatteryIncludedSearchParams } from '../../model';

/**
 * Builds search parameters for Battery Included API
 * @param params Search parameters
 * @returns URL search parameters string
 */
export function buildSearchParams<T>(params: BatteryIncludedSearchParams<T>): string {
  const queryParams = new URLSearchParams();

  // Preserve the explicit empty bootstrap query (`q=`) while still omitting undefined.
  if (params.query !== undefined) {
    queryParams.append('q', params.query);
  }

  const page = params.page ?? 1;
  queryParams.append('page', page.toString());

  // Preserve explicit `0` for the category-tree bootstrap contract.
  const size = params.size ?? 10;
  queryParams.append('per_page', size.toString());

  // Add sort parameter
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }

  if (params.analyze !== undefined) {
    queryParams.append('analyze', String(params.analyze));
  }

  const variables = {
    ...(params.locale ? { locale: params.locale } : {}),
    ...(params.variables ?? {}),
  };
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== '') {
      queryParams.append(`v[${key}]`, value);
    }
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
