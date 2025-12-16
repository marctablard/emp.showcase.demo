import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '../ui/button';
import type { ProductListItem } from './product-list';

interface ProductItemRowProps {
  item: ProductListItem;
  showNetUnderGross?: boolean;
}

export function ProductItemRow({ item, showNetUnderGross = false }: ProductItemRowProps) {
  const t = useTranslations('cart');
  return (
    <div className="py-6 first:border-none border-t border-border-primary sm:first:border-solid">
      <div className="grid grid-cols-[1fr_2fr] sm:grid-cols-[120px_2fr_1fr_1fr] md:grid-cols-[120px_3fr_11fr_1fr]">
        <div className="col-start-1 row-start-2 sm:row-start-1 row-end-3">
          <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] sm:w-[120px] sm:h-[78px] object-fit overflow-hidden bg-surface-image-background">
            {item.imageUrl ? (
              <Image
                width={120}
                height={78}
                src={String(item.imageUrl)}
                alt={String(item.name)}
                className="rounded-ss-[inherit] rounded-ee-[inherit] w-[100px] h-[65px] sm:w-[120px] sm:h-[78px] object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-placeholders text-sm">
                {item.itemNumber || 'Item'}
              </div>
            )}
          </div>
        </div>

        <div className="col-start-1 col-end-3 row-start-1 sm:col-start-2 flex flex-col gap-1 mb-4 sm:mb-0 sm:mx-4">
          {item.brand && <p className="text-sm sm:text-base">{item.brand}</p>}
          {item.href ? (
            <a
              href={item.href}
              className="font-bold text-base font-headlines text-text-action hover:underline hover:text-text-action-hover"
            >
              {item.name}
            </a>
          ) : (
            <p className="font-bold text-base font-headlines">{item.name}</p>
          )}
          {item.itemNumber && <p className="text-sm text-text-placeholders">{item.itemNumber}</p>}
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-1">
              <div className="text-text-success">
                <Package className="h-4 w-4" />
              </div>
              <p className="text-sm text-text-success">{t('available')}</p>
            </div>
            <Button
              variant="link"
              size="small"
              className="normal-case text-sm tracking-normal p-0 justify-start self-start"
            >
              {t('addToWishlist')}
            </Button>
          </div>
        </div>

        <div className="col-start-2 row-start-4 sm:col-start-3 sm:col-end-3 sm:row-start-1 md:col-start-3 flex items-start sm:items-center sm:justify-start">
          <p className="text-sm sm:text-base">{item.quantity}</p>
        </div>

        <div className="col-start-2 row-start-2 sm:col-start-4 sm:row-start-1 sm:row-end-3 md:col-start-4 flex flex-col gap-1 ps-4 sm:ps-0">
          <div className="font-bold sm:text-end">{formatCurrency(item.unitPrice, item.currency)}</div>
          {showNetUnderGross && (
            <span className="text-sm text-text-placeholders sm:text-end">
              {/* Placeholder for net value if caller wants to provide it in future */}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
