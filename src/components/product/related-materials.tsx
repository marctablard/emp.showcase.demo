'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/hooks/product/useProducts';
import { useL10n } from '@/hooks/useL10n';
import { cn } from '@/lib/utils';
import type { RelatedItem } from '@/platform/services/model/product';
import { H2, Overline } from '../ui/h';
import { RelatedMaterialItem } from './related-material-item';

interface RelatedMaterialsProps {
  relatedItems?: RelatedItem[];
  locale: string;
  className?: string;
}

const RELATED_ITEM_TYPES = ['All', 'Accessory', 'Compulsory', 'Consumable', 'Part', 'Similar', 'Upsell'] as const;
type RelatedItemType = (typeof RELATED_ITEM_TYPES)[number];

export function RelatedMaterials({ relatedItems, locale, className }: RelatedMaterialsProps) {
  const t = useTranslations('product.relatedMaterials');
  const { l10n } = useL10n(locale);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RelatedItemType>('All');

  // Extract product IDs from related items
  const productIds = useMemo(() => (relatedItems || []).map((item) => item.refId), [relatedItems]);

  // Fetch all related products
  const { products, loading } = useProducts(productIds, { prices: true });

  // Create a map of product ID to related item type
  const productTypeMap = useMemo(() => {
    const map = new Map<string, RelatedItem['type']>();
    (relatedItems || []).forEach((item) => {
      map.set(item.refId, item.type);
    });
    return map;
  }, [relatedItems]);

  // Filter and search products
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products;

    // Filter by type
    if (selectedType !== 'All') {
      filtered = filtered.filter((product) => productTypeMap.get(product.id) === selectedType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) => {
        const name = l10n(product.name).toLowerCase();
        const brandName = product.brand?.name ? l10n(product.brand.name).toLowerCase() : '';
        return name.includes(query) || brandName.includes(query) || product.id.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [products, selectedType, searchQuery, productTypeMap, l10n]);

  // Don't render if no related items
  if (!relatedItems || relatedItems.length === 0) {
    return null;
  }

  return (
    <div className={cn('mb-16', className)}>
      {/* Header */}
      <div className="mb-6">
        <Overline className="text-text-action">{t('overline')}</Overline>
        <H2 variant="h3" className="mb-6">
          {t('title')}
        </H2>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-icon-neutral" />
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-64">
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as RelatedItemType)}>
              <SelectTrigger>
                <SelectValue placeholder={t('filterByType')} />
              </SelectTrigger>
              <SelectContent>
                {RELATED_ITEM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type.toLowerCase()}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-text-body">{t('loading')}</p>
        </div>
      )}

      {/* No Results */}
      {!loading && filteredProducts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-text-body">{t('noResults')}</p>
        </div>
      )}

      {/* Products List */}
      {!loading && filteredProducts.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Header Row */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-surface-disabled rounded-sm">
            <div className="w-20 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-headings">{t('columnProduct')}</p>
            </div>
            <div className="w-32 flex-shrink-0">
              <p className="text-sm font-semibold text-text-headings">{t('columnType')}</p>
            </div>
            <div className="w-24 flex-shrink-0 hidden md:block">
              <p className="text-sm font-semibold text-text-headings">{t('columnPrice')}</p>
            </div>
            <div className="w-[184px] flex-shrink-0">
              <p className="text-sm font-semibold text-text-headings">{t('columnQuantity')}</p>
            </div>
            <div className="w-10 flex-shrink-0"></div>
          </div>

          {/* Product Rows */}
          {filteredProducts.map((product) => (
            <RelatedMaterialItem
              key={product.id}
              product={product}
              locale={locale}
              relationType={productTypeMap.get(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
