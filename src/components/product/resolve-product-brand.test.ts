import { coalesceBrandLabel, resolveProductBrandLabel } from './resolve-product-brand';

const l10n = (value: unknown) => (typeof value === 'string' ? value : '');

describe('resolveProductBrandLabel', () => {
  it('prefers brand.name over manufacturer specification', () => {
    expect(
      resolveProductBrandLabel(
        {
          brand: { id: 'b1', name: 'Victron Energy' },
          specifications: [{ key: 'manufacturer', value: 'Other' }],
        } as any,
        l10n,
      ),
    ).toBe('Victron Energy');
  });

  it('falls back to manufacturer specification when brand name is absent', () => {
    expect(
      resolveProductBrandLabel(
        {
          specifications: [{ key: 'manufacturer', value: 'Serie GMV 6' }],
        } as any,
        l10n,
      ),
    ).toBe('Serie GMV 6');
  });

  it('returns undefined when no brand source is available', () => {
    expect(resolveProductBrandLabel({} as any, l10n)).toBeUndefined();
    expect(resolveProductBrandLabel(undefined, l10n)).toBeUndefined();
  });
});

describe('coalesceBrandLabel', () => {
  it('prefers snapshot brand over catalog brand', () => {
    expect(coalesceBrandLabel('Snapshot', 'Catalog')).toBe('Snapshot');
    expect(coalesceBrandLabel('  ', 'Catalog')).toBe('Catalog');
    expect(coalesceBrandLabel(undefined, 'Catalog')).toBe('Catalog');
    expect(coalesceBrandLabel(undefined, undefined)).toBeUndefined();
  });
});
