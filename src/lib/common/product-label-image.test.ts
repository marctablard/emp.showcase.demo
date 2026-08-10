import { resolveProductLabelImageUrl } from './product-label-image';

describe('resolveProductLabelImageUrl', () => {
  it('returns absolute http(s) image URLs', () => {
    expect(resolveProductLabelImageUrl('https://cdn.example.com/label.png')).toBe('https://cdn.example.com/label.png');
    expect(resolveProductLabelImageUrl('http://res.cloudinary.com/saas-ag/image/upload/x')).toBe(
      'http://res.cloudinary.com/saas-ag/image/upload/x',
    );
  });

  it('rejects cloudinary storage paths and empty values', () => {
    expect(resolveProductLabelImageUrl('showcase/media/683987a0f1ce3e61a7ad9dc5')).toBeUndefined();
    expect(resolveProductLabelImageUrl('')).toBeUndefined();
    expect(resolveProductLabelImageUrl('   ')).toBeUndefined();
    expect(resolveProductLabelImageUrl(null)).toBeUndefined();
    expect(resolveProductLabelImageUrl(undefined)).toBeUndefined();
  });
});
