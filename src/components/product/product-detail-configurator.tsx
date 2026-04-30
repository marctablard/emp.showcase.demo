'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { FlipHorizontal2, Pin, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useL10n } from '@/hooks/useL10n';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { H1, Overline } from '../ui/h';
import { RatingStarRow } from '../ui/rating';
import ProductAddToCartButton from './product-add-to-cart-button';

export interface ProductDetailConfiguratorProps {
  product?: Product;
  className?: string;
  price?: ProductPrice | null;
}

export default function ProductDetailConfigurator({ product, className, price }: ProductDetailConfiguratorProps) {
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('product');

  if (!product) {
    return null;
  }

  return (
    <div className={className}>
      {/* Header Section - Same as regular product detail page */}
      <div className="mb-6">
        {/* Badges and Action Buttons */}
        <div className="flex justify-between mb-4">
          <div className="flex gap-2">
            {product.labels?.map((label) => (
              <Badge key={label.id} variant="info" rounded="roundedRight" className="h-7">
                {label.name}
              </Badge>
            ))}
          </div>
          <div className="hidden md:flex gap-2">
            <Button size="icon" variant="secondary" aria-label={t('compare')}>
              <FlipHorizontal2 />
            </Button>
            <Button size="icon" variant="secondary" aria-label={t('addToWishlist')}>
              <Pin />
            </Button>
            <Button size="icon" variant="secondary" aria-label={t('share')}>
              <Share2 />
            </Button>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <div className="flex md:hidden justify-center gap-2 mb-4">
          <Button size="icon" variant="secondary" aria-label={t('compare')}>
            <FlipHorizontal2 />
          </Button>
          <Button size="icon" variant="secondary" aria-label={t('addToWishlist')}>
            <Pin />
          </Button>
          <Button size="icon" variant="secondary" aria-label={t('share')}>
            <Share2 />
          </Button>
        </div>

        {/* Brand, Product Name, and Rating */}
        <div className="mb-6">
          {product.brand && (
            <Overline className="flex items-center gap-2 mb-2">
              {product.brand.logo?.url && (
                <Image
                  src={product.brand.logo?.url}
                  alt={product.brand.name ? l10n(product.brand.name) : ''}
                  height={70}
                  width={70}
                />
              )}
              <span>{product.brand.name ? l10n(product.brand.name) : ''}</span>
            </Overline>
          )}
          <H1 className="mb-4">{l10n(product.name)}</H1>
          <div className="flex gap-2 items-center mb-4">
            <p className="text-text-on-disabled font-bold">4.6</p>
            <RatingStarRow starsCount={5} filledCount={4} className="py-2" />
            <p className="text-text-on-disabled text-sm">(114)</p>
          </div>
        </div>
      </div>

      {/* Iframe Section - Full Width */}
      <div className="w-full mb-6">
        <iframe
          src="https://portal.combeenation.com/cfgr/ANYMOTION/GARAGENTOR/"
          className="w-full border-0"
          style={{ minHeight: '600px', height: '100vh' }}
          title="Product Configurator"
          allow="fullscreen"
        />
      </div>

      {/* Add to Cart Section - Quantity fixed at 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-2 w-fit ml-auto mb-12">
        <div className="flex items-center sm:w-auto sm:flex-shrink-0">
          <Input
            id="quantity"
            type="number"
            min="1"
            max="1"
            value="1"
            readOnly
            disabled
            aria-label={t('quantity')}
            className="text-center min-w-[14] w-full h-13 border border-border-primary rounded-sm sm:[appearance:textfield] sm:[&::-webkit-outer-spin-button]:appearance-none sm:[&::-webkit-inner-spin-button]:appearance-none bg-surface-disabled"
          />
        </div>
        <ProductAddToCartButton
          product={product}
          price={price}
          quantity={1}
          className="w-full sm:w-auto h-[52px] mt-4 sm:mt-0"
        />
      </div>
    </div>
  );
}
