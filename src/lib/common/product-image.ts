export const PRODUCT_NO_IMAGE_SRC = '/images/no_image_alt.png';

export function resolveProductImageSrc(url?: string | null): string {
  if (typeof url !== 'string') {
    return PRODUCT_NO_IMAGE_SRC;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return PRODUCT_NO_IMAGE_SRC;
  }

  return trimmed;
}
