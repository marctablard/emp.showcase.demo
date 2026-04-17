type BuildSearchPaginationUrlParams = {
  origin: string;
  nextPage: number;
  pageSize: number;
  siteCode: string;
  locale: string;
  query?: string;
  sort?: string;
  currency?: string;
};

export const buildSearchPaginationUrl = ({
  origin,
  nextPage,
  pageSize,
  siteCode,
  locale,
  query,
  sort,
  currency,
}: BuildSearchPaginationUrlParams): URL => {
  const url = new URL('/api/search', origin);

  if (query) {
    url.searchParams.append('query', query);
  }

  url.searchParams.append('page', nextPage.toString());
  url.searchParams.append('size', pageSize.toString());

  if (sort) {
    url.searchParams.append('sort', sort);
  }

  url.searchParams.append('site', siteCode);
  url.searchParams.append('locale', locale);

  if (currency) {
    url.searchParams.append('currency', currency);
  }

  return url;
};
