'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { Product } from '../types';
import { formatPrice, handleImageError } from '../utils';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string, quantity: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const t = useTranslations('account.AiHelper');
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    onAddToCart(product.productId, quantity);
  };

  const incrementQuantity = () => {
    setQuantity((prev) => prev + 1);
  };

  const decrementQuantity = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price || 0));
  const originalPrice =
    product.originalPrice && typeof product.originalPrice === 'number'
      ? product.originalPrice
      : parseFloat(String(product.originalPrice || 0));

  return (
    <div className="p-4 bg-surface-primary rounded-xl border border-border-primary shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start space-x-4">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            width={80}
            height={80}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            onError={handleImageError}
            unoptimized
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-headings text-base mb-1">{product.name}</div>
          {product.brand && <div className="text-sm text-text-body mb-2">{product.brand}</div>}
          {product.description && <div className="text-sm text-text-body mb-3 line-clamp-2">{product.description}</div>}
          <div className="flex items-center space-x-3 mb-3">
            {product.price ? (
              <span className="font-semibold text-text-headings text-base">{formatPrice(price, product.currency)}</span>
            ) : (
              <span className="text-base text-text-placeholders">{t('priceOnRequest')}</span>
            )}
            {product.originalPrice && (
              <span className="text-sm text-text-disabled line-through">
                {formatPrice(originalPrice, product.currency)}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center border border-border-disabled rounded-lg">
              <button
                onClick={decrementQuantity}
                className="px-3 py-2 text-sm hover:bg-surface-disabled rounded-l-lg transition-colors"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="px-4 py-2 text-sm border-x border-border-disabled bg-surface-image-background">
                {quantity}
              </span>
              <button
                onClick={incrementQuantity}
                className="px-3 py-2 text-sm hover:bg-surface-disabled rounded-r-lg transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="px-4 py-2 bg-surface-action text-text-on-action text-sm rounded-lg hover:bg-surface-action-hover transition-colors font-medium"
            >
              {t('addToCart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
