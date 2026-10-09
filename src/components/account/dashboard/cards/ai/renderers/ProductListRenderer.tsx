'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { toDisplayString } from '@/lib/common/ai-tool-widgets';
import { cn } from '@/lib/utils';
import type { Product, ProductData, ProductListData } from '../types';
import { formatPrice } from '../utils';
import { widgetOrSkeleton } from './WidgetSkeleton';
import { AiQuantityStepper, AiThumbnail, AiWidgetFrame, aiWidgetPaddingX } from './ai-widget-kit';

interface ProductListRendererProps {
  data: ProductListData;
  onAddToCart: (productId: string, quantity: number) => void;
}

function toAmount(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const amount = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(amount) ? amount : undefined;
}

function ProductRow({
  product,
  onAddToCart,
}: Readonly<{ product: Product; onAddToCart: ProductListRendererProps['onAddToCart'] }>) {
  const t = useTranslations('account.AiHelper');
  const [quantity, setQuantity] = useState(1);

  const name = toDisplayString(product.name) ?? product.productId;
  const brand = toDisplayString(product.brand);
  const description = toDisplayString(product.description);
  const price = toAmount(product.price);
  const originalPrice = toAmount(product.originalPrice);
  const testIdPrefix = `aiProducts-${product.productId}`;

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 py-3', aiWidgetPaddingX)}>
      <AiThumbnail src={product.image} alt={name} size={56} />
      <div className="min-w-0 flex-1 basis-40">
        {brand ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-placeholders">{brand}</p>
        ) : null}
        <UiLink
          type="Link"
          href={`/product/${product.productId}`}
          variant="text"
          className="line-clamp-2 font-semibold text-text-headings"
          data-testid={`${testIdPrefix}-link`}
        >
          {name}
        </UiLink>
        {description ? <p className="line-clamp-1 text-xs text-text-placeholders">{description}</p> : null}
        <p className="mt-0.5 flex items-baseline gap-2 tabular-nums">
          {price == null ? (
            <span className="text-text-placeholders">{t('priceOnRequest')}</span>
          ) : (
            <span className="font-semibold text-text-headings">{formatPrice(price, product.currency)}</span>
          )}
          {originalPrice ? (
            <span className="text-xs text-text-disabled line-through">
              {formatPrice(originalPrice, product.currency)}
            </span>
          ) : null}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <AiQuantityStepper value={quantity} onChange={setQuantity} testIdPrefix={testIdPrefix} />
        <Button
          type="button"
          size="small"
          className="h-8 px-3 text-sm"
          onClick={() => onAddToCart(product.productId, quantity)}
          data-testid={`${testIdPrefix}-addToCart`}
        >
          {t('addToCart')}
        </Button>
      </div>
    </li>
  );
}

export const ProductListRenderer: React.FC<ProductListRendererProps> = ({ data, onAddToCart }) => {
  const context = toDisplayString(data.context);

  return widgetOrSkeleton(
    data.products,
    <div className="space-y-2">
      {context ? <p className="px-1 text-sm text-text-body">{context}</p> : null}
      <AiWidgetFrame>
        <ul className="divide-y divide-border-primary">
          {data.products?.map((product: ProductData, index: number) => (
            <ProductRow key={product.productId || `product-${index}`} product={product} onAddToCart={onAddToCart} />
          ))}
        </ul>
      </AiWidgetFrame>
    </div>,
  );
};
