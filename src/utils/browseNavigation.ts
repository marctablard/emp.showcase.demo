import { browseSearchStateSignature, extractFiltersFromUrlSearchParams } from '@/utils/filterUtils';

const BROWSE_DEFAULT_PAGE_SIZE = 12;

export function getBrowseTargetSignature(href: string): string | null {
  if (!href.startsWith('/')) {
    return null;
  }

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  let url: URL;

  try {
    url = new URL(href, baseOrigin);
  } catch {
    return null;
  }

  if (!url.pathname.endsWith('/browse')) {
    return null;
  }

  const q = url.searchParams.get('q') ?? '';
  const pageRaw = url.searchParams.get('page');
  const page = pageRaw !== null ? Number.parseInt(pageRaw, 10) : 0;
  const sizeRaw = url.searchParams.get('size');
  const size = sizeRaw !== null ? Number.parseInt(sizeRaw, 10) : BROWSE_DEFAULT_PAGE_SIZE;
  const sort = url.searchParams.get('sort') ?? undefined;

  return browseSearchStateSignature({
    query: q,
    page: Number.isFinite(page) ? page : 0,
    size: Number.isFinite(size) ? size : BROWSE_DEFAULT_PAGE_SIZE,
    sort,
    filters: extractFiltersFromUrlSearchParams(url.searchParams),
  });
}
