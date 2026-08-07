/**
 * Product label `image` is an absolute media URL when present.
 * `cloudinaryUrl` is a storage path only and must not be used as an `<img src>`.
 */
export function resolveProductLabelImageUrl(image: string | undefined | null): string | undefined {
  if (typeof image !== 'string') {
    return undefined;
  }

  const trimmed = image.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}
