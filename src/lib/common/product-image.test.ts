import { PRODUCT_NO_IMAGE_SRC, resolveProductImageSrc } from './product-image';

describe('resolveProductImageSrc', () => {
  it('returns the canonical placeholder for empty values', () => {
    expect(PRODUCT_NO_IMAGE_SRC).toBe('/images/no_image_alt.png');
    expect(resolveProductImageSrc()).toBe(PRODUCT_NO_IMAGE_SRC);
    expect(resolveProductImageSrc(undefined)).toBe(PRODUCT_NO_IMAGE_SRC);
    expect(resolveProductImageSrc(null)).toBe(PRODUCT_NO_IMAGE_SRC);
    expect(resolveProductImageSrc('')).toBe(PRODUCT_NO_IMAGE_SRC);
  });

  it('returns the canonical placeholder for whitespace-only values', () => {
    expect(resolveProductImageSrc('   ')).toBe(PRODUCT_NO_IMAGE_SRC);
    expect(resolveProductImageSrc('\t\n')).toBe(PRODUCT_NO_IMAGE_SRC);
  });

  it('returns the URL when it is non-empty', () => {
    expect(resolveProductImageSrc('https://cdn.example.com/product.jpg')).toBe('https://cdn.example.com/product.jpg');
    expect(resolveProductImageSrc('/media/sku-123.png')).toBe('/media/sku-123.png');
    expect(resolveProductImageSrc('  https://cdn.example.com/product.jpg  ')).toBe(
      'https://cdn.example.com/product.jpg',
    );
  });
});
