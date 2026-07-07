import type {
  BatteryIncludedBrowseVariables,
  BatteryIncludedSearchParams,
  BatteryIncludedVisibilityContext,
} from '../../model';

type SerializableBatteryIncludedFilters = Record<
  string,
  string | string[] | Record<string, string | number | string[]>
>;

function appendFilters(queryParams: URLSearchParams, filters: SerializableBatteryIncludedFilters | undefined): void {
  if (!filters) {
    return;
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        queryParams.append(`f[${key}][]`, entry);
      });
      return;
    }

    if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([subKey, subValue]) => {
        queryParams.append(`f[${key}][${subKey}]`, String(subValue));
      });
      return;
    }

    queryParams.append(`f[${key}]`, String(value));
  });
}

function isVisibilityContext(
  visibility: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
): visibility is BatteryIncludedVisibilityContext {
  return 'variables' in visibility || 'filters' in visibility;
}

export function appendBatteryIncludedVisibility(
  queryParams: URLSearchParams,
  visibility?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
): void {
  if (!visibility) {
    return;
  }

  const variables = isVisibilityContext(visibility) ? visibility.variables : visibility;
  Object.entries(variables ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(`v[${key}]`, value);
    }
  });

  if (isVisibilityContext(visibility)) {
    appendFilters(queryParams, visibility.filters);
  }
}

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

  if (params.variants !== undefined) {
    queryParams.append('variants', String(params.variants));
  }

  if (params.analyze !== undefined) {
    queryParams.append('analyze', String(params.analyze));
  }

  if (params.visibility) {
    appendBatteryIncludedVisibility(queryParams, params.visibility);
  } else {
    appendBatteryIncludedVisibility(queryParams, {
      ...(params.locale ? { locale: params.locale } : {}),
      ...(params.variables ?? {}),
    });
  }

  // Add preset parameter
  if (params.preset) {
    queryParams.append('preset', params.preset);
  }

  // Add filters
  appendFilters(queryParams, params.visibility ? undefined : params.filters);

  return queryParams.toString();
}
