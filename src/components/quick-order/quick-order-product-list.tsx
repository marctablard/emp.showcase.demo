'use client';

import { useTranslations } from 'next-intl';
import type { QuickOrderItem } from '@/hooks/quick-order/useQuickOrderList';
import { QuickOrderProductCard } from './quick-order-product-card';
import { QuickOrderProductRow } from './quick-order-product-row';

interface QuickOrderProductListProps {
  items: QuickOrderItem[];
  onRemoveProduct: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
}

export function QuickOrderProductList({ items, onRemoveProduct, onUpdateQuantity }: QuickOrderProductListProps) {
  const t = useTranslations('quick-order');

  if (items.length === 0) {
    return (
      <div className="py-8 text-center" data-testid="quick-order-product-list-empty">
        <p className="text-sm text-text-placeholders">{t('productList.empty')}</p>
      </div>
    );
  }

  return (
    <div data-testid="quick-order-product-list">
      {/* Desktop/Tablet table layout */}
      <div className="hidden sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-primary text-left">
              <th className="py-3 pr-4 text-sm font-bold text-text-body">{t('productList.product')}</th>
              <th className="py-3 px-4 text-sm font-bold text-text-body">{t('productList.quantity')}</th>
              <th className="py-3 px-4 text-sm font-bold text-text-body text-right">{t('productList.unitPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <QuickOrderProductRow
                key={item.product.id}
                product={item.product}
                quantity={item.quantity}
                onRemove={() => onRemoveProduct(item.product.id)}
                onUpdateQuantity={(qty) => onUpdateQuantity(item.product.id, qty)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden">
        {items.map((item) => (
          <QuickOrderProductCard
            key={item.product.id}
            product={item.product}
            quantity={item.quantity}
            onRemove={() => onRemoveProduct(item.product.id)}
            onUpdateQuantity={(qty) => onUpdateQuantity(item.product.id, qty)}
          />
        ))}
      </div>
    </div>
  );
}
