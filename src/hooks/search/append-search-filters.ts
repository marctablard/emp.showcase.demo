import type { SearchFilters } from '@/platform/services/model/common';

export function appendSearchFilters(url: URL, filters: SearchFilters | undefined): void {
  if (!filters) {
    return;
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((val) => {
        url.searchParams.append(`filters[${key}][]`, val);
      });
      return;
    }

    if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        url.searchParams.append(`filters[${key}][${nestedKey}]`, String(nestedValue));
      });
      return;
    }

    url.searchParams.append(`filters[${key}]`, String(value));
  });
}
