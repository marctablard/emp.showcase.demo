'use client';

import { useLocale, useTranslations } from 'next-intl';
import { H5 } from '@/components/ui/h';
import { useL10n } from '@/hooks/useL10n';
import type { Product } from '@/platform/services/model/product';

interface ComparisonTableProps {
  products: Product[];
}

export function ComparisonTable({ products }: ComparisonTableProps) {
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('comparison');

  if (products.length === 0) {
    return null;
  }

  // Collect specification keys present in each product
  const specKeysByProduct = products.map((product) => new Set(product.specifications?.map((spec) => spec.key) ?? []));

  // Find keys present in at least 2 products
  const allKeys = new Map<string, number>();
  for (const keySet of specKeysByProduct) {
    for (const key of keySet) {
      allKeys.set(key, (allKeys.get(key) ?? 0) + 1);
    }
  }
  const sharedKeys = [...allKeys.entries()].filter(([, count]) => count >= 2).map(([key]) => key);

  // Get spec label for a key (from first product that has it)
  const getSpecLabel = (key: string): string => {
    for (const product of products) {
      const spec = product.specifications?.find((s) => s.key === key);
      if (spec) {
        return l10n(spec.label);
      }
    }
    return key;
  };

  // Get spec value for a product and key
  const getSpecValue = (product: Product, key: string): string => {
    const spec = product.specifications?.find((s) => s.key === key);
    if (!spec) return '—';
    const value = l10n(spec.value);
    const unit = spec.unit ? ` ${l10n(spec.unit)}` : '';
    return `${value}${unit}`;
  };

  // Check if actual (non-empty) values differ across products for a given key
  const valuesDiffer = (key: string): boolean => {
    const values = products.map((p) => getSpecValue(p, key)).filter((v) => v !== '—');
    if (values.length <= 1) return false;
    return new Set(values).size > 1;
  };

  type Row = { key: string; label: string; values: string[]; differ: boolean };

  const rows: Row[] = [
    // TODO: implement when categories will be availiable throu indexer (like BatteryIncluded)
    // {
    //   key: 'category',
    //   label: t('category'),
    //   values: products.map((p) => (p.primaryCategory?.name ? l10n(p.primaryCategory.name) : '—')),
    //   differ: listValuesDiffer(products.map((p) => (p.primaryCategory?.name ? l10n(p.primaryCategory.name) : '—'))),
    // },
    ...sharedKeys.map((key) => ({
      key,
      label: getSpecLabel(key),
      values: products.map((p) => getSpecValue(p, key)),
      differ: valuesDiffer(key),
    })),
  ];

  return (
    <div className="border-t border-border-primary mt-6">
      {/* Section heading */}
      <div className="py-6">
        <H5>{t('productAttributes')}</H5>
      </div>

      {sharedKeys.length > 0 ? (
        <>
          {/* Row-based table */}
          <div
            role="table"
            aria-label={t('productAttributes')}
            className="w-full border border-border-primary rounded-sm"
          >
            {/* Data rows */}
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex w-full rounded-sm transition-colors duration-200 hover:bg-surface-image-background"
                role="row"
              >
                <div className="w-[279px] shrink-0 px-4 py-4">
                  <span className="text-base font-bold text-text-body" role="rowheader">
                    {row.label}
                  </span>
                </div>
                {row.values.map((value, index) => (
                  <div
                    key={products[index].id}
                    className="flex flex-1 min-w-0 border-l border-border-primary px-4 py-4"
                  >
                    <span
                      className={`text-base text-text-body ${row.differ ? 'font-bold' : 'font-normal'}`}
                      role="cell"
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="p-6 text-center text-text-on-disabled">{t('noSharedAttributes')}</p>
      )}
    </div>
  );
}
