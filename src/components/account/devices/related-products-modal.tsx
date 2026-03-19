'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { RelatedMaterialItem } from '@/components/product/related-material-item';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useProducts } from '@/hooks/product/useProducts';
import { useL10n } from '@/hooks/useL10n';
import { RelatedItem } from '@/platform/services/model/product';

interface RelatedProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatedItems: RelatedItem[];
  locale: string;
  deviceName: string;
}

export function RelatedProductsModal({
  open,
  onOpenChange,
  relatedItems,
  locale,
  deviceName,
}: RelatedProductsModalProps) {
  const t = useTranslations('account.devices.relatedProducts');
  const { l10n } = useL10n(locale);
  const [searchQuery, setSearchQuery] = useState('');

  const productIds = useMemo(() => (relatedItems || []).map((item) => item.refId), [relatedItems]);

  const { products, loading } = useProducts(productIds, { prices: true });

  const productTypeMap = useMemo(() => {
    const map = new Map<string, RelatedItem['type']>();
    (relatedItems || []).forEach((item) => {
      map.set(item.refId, item.type);
    });
    return map;
  }, [relatedItems]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return products.filter((product) => {
        const name = l10n(product.name).toLowerCase();
        const brandName = product.brand?.name ? l10n(product.brand.name).toLowerCase() : '';
        return name.includes(query) || brandName.includes(query) || product.id.toLowerCase().includes(query);
      });
    }

    return products;
  }, [products, searchQuery, l10n]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { deviceName })}</DialogDescription>
        </DialogHeader>

        <div className="mb-4">
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

        {loading && (
          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Spinner color="primary" variant="md" />
              <div>{t('loading')}</div>
            </div>
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-body">{t('noResults')}</p>
          </div>
        )}

        {!loading && filteredProducts.length > 0 && (
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
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
      </DialogContent>
    </Dialog>
  );
}
