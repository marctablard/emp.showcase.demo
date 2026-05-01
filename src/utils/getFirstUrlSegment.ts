export const getFirstUrlSegment = (url: string, fallback = ''): string => {
  const trimmed = url.startsWith('/') ? url.slice(1) : url;
  const firstSegment = trimmed.split('/')[0].split('?')[0];
  return firstSegment || fallback;
};
