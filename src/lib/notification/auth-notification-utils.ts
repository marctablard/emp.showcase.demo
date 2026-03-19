const LOGIN_QUERY_PARAM = 'login';
const ERROR_QUERY_PARAM = 'error';
const CART_MERGE_STATUS_FALLBACK = 'FALLBACK';

export function stripAuthNotificationQueryParams(urlString: string): string {
  const url = new URL(urlString);
  url.searchParams.delete(LOGIN_QUERY_PARAM);
  url.searchParams.delete(ERROR_QUERY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isCartMergeFallback(status: string | undefined): boolean {
  return status === CART_MERGE_STATUS_FALLBACK;
}
