import { resolveProductVariantAttributeLabel } from './variant-attribute-label';

describe('resolveProductVariantAttributeLabel', () => {
  const l10n = (input: unknown) => (typeof input === 'string' ? input : '');

  it('returns translated label when translation exists', () => {
    const t = jest.fn().mockReturnValue('Width');

    expect(resolveProductVariantAttributeLabel({ key: 'Breite', name: 'Breite' }, t, l10n)).toBe('Width');
  });

  it('falls back to localized attribute name when translation is missing', () => {
    const t = jest.fn().mockReturnValue('product.filters.mixins.productVariantAttributes.Unknown');

    expect(
      resolveProductVariantAttributeLabel({ key: 'Unknown', name: { en: 'Custom label' } }, t, (input) =>
        typeof input === 'object' && input && 'en' in input ? String((input as { en: string }).en) : '',
      ),
    ).toBe('Custom label');
  });

  it('falls back to attribute key when translation and name are unavailable', () => {
    const t = jest.fn().mockReturnValue('product.filters.mixins.productVariantAttributes.Foo');

    expect(resolveProductVariantAttributeLabel({ key: 'Foo' }, t, l10n)).toBe('Foo');
  });
});
