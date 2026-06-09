'use client';

import { forwardRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Spinner } from '@/components/ui/spinner';
import { useL10n } from '@/hooks/useL10n';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import { HighlightedText } from './highlighted-text';

function stripHighlightMarkup(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, '').trim();
}

interface QuickOrderSearchDropdownProps {
  products: Product[];
  loading: boolean;
  hasSearched: boolean;
  highlightedIndex: number;
  onSelect: (product: Product) => void;
}

export const QuickOrderSearchDropdown = forwardRef<HTMLDivElement, QuickOrderSearchDropdownProps>(
  function QuickOrderSearchDropdown({ products, loading, hasSearched, highlightedIndex, onSelect }, ref) {
    const t = useTranslations('quick-order');
    const { l10n } = useL10n();

    const handleSelect = useCallback(
      (product: Product) => {
        onSelect(product);
      },
      [onSelect],
    );

    return (
      <div
        ref={ref}
        id="quick-order-search-results"
        role="listbox"
        aria-label={t('accessibility.searchResults')}
        className="absolute z-50 top-full left-0 w-full mt-1 bg-surface-page border border-border-primary rounded-sm shadow-lg max-h-80 overflow-y-auto"
      >
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Spinner variant="sm" />
          </div>
        )}

        {!loading && hasSearched && products.length === 0 && (
          <div className="px-4 py-6 text-sm text-text-placeholders text-center" role="status">
            {t('search.noResults')}
          </div>
        )}

        {!loading &&
          products.map((product, index) => {
            const image = product.images?.[0];
            const brandName = l10n(product.brand?.name || '');
            const productName = l10n(product.name);
            const plainProductName = stripHighlightMarkup(productName);
            const itemNumber = product.sku || product.id;
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border-primary last:border-b-0 cursor-pointer ${
                  isHighlighted ? 'bg-surface-action-hover-2' : 'hover:bg-surface-action-hover-2'
                }`}
                onClick={() => handleSelect(product)}
                data-testid={`search-result-${product.id}`}
              >
                <div className="flex-shrink-0 w-[60px] h-[39px] rounded-sm overflow-hidden bg-surface-image-background flex items-center justify-center">
                  {image?.url ? (
                    <Image
                      src={image.url}
                      alt={stripHighlightMarkup(l10n(image.altText || '')) || plainProductName}
                      width={60}
                      height={39}
                      className="object-contain w-[60px] h-[39px]"
                    />
                  ) : (
                    <Image
                      src="/images/no_image_alt.png"
                      alt={plainProductName}
                      width={60}
                      height={39}
                      className="object-contain"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {brandName && (
                    <p className="text-sm text-text-placeholders truncate">
                      <HighlightedText text={brandName} />
                    </p>
                  )}
                  <p className="text-sm font-headlines text-text-body truncate">
                    <HighlightedText text={productName || ''} />
                  </p>
                  <p className="text-sm text-text-placeholders">{itemNumber}</p>
                </div>
                <div className="flex-shrink-0 text-right self-end">
                  {product.price && (
                    <>
                      {product.price.originalAmount && product.price.originalAmount > product.price.amount && (
                        <p className="text-sm text-text-placeholders line-through">
                          {formatCurrency(product.price.originalAmount, product.price.currency)}
                        </p>
                      )}
                      <p className="text-sm font-bold font-headlines">
                        {formatCurrency(product.price.amount, product.price.currency)}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}
      </div>
    );
  },
);
