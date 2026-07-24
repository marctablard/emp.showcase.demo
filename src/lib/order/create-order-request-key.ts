export function createOrderRequestKey(pageSize: number, pageNumber: number, query?: string, sort?: string): string {
  return JSON.stringify({
    pageSize,
    pageNumber,
    sort: sort ?? null,
    query: query ?? null,
  });
}
