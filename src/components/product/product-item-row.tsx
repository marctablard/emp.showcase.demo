import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { ProductListItem } from './product-list';

interface ProductItemRowProps {
  readonly item: ProductListItem;
  readonly showNetUnderGross?: boolean;
}

export function ProductItemRow({ item, showNetUnderGross = false }: ProductItemRowProps) {
  const t = useTranslations('cart');
  return (
    <div className="flex flex-col gap-3 py-6 first:pt-4 sm:grid sm:grid-cols-[minmax(280px,1.6fr)_100px_minmax(140px,1fr)] sm:items-center sm:gap-6">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-[78px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-tl-lg rounded-br-lg bg-surface-image-background">
          {item.imageUrl ? (
            <Image
              width={120}
              height={78}
              src={String(item.imageUrl)}
              alt={String(item.name)}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="h-full w-full bg-surface-image-background" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {item.brand && <p className="text-base font-body text-text-body">{item.brand}</p>}
          {item.href ? (
            <Link
              href={item.href}
              className="break-words text-2xl font-bold font-headlines text-text-headings hover:underline"
            >
              {item.name}
            </Link>
          ) : (
            <p className="break-words text-2xl font-bold font-headlines text-text-headings">{item.name}</p>
          )}
          {item.itemNumber && (
            <p className="text-sm text-text-placeholders">
              {t('itemNumber')}: {item.itemNumber}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:block sm:text-right">
        <span className="text-sm text-text-body sm:hidden">{t('quantity')}</span>
        <span className="text-base font-body">{item.quantity}</span>
      </div>

      <div className="text-right">
        <div className="flex flex-col sm:items-end">
          <span className="text-2xl font-bold font-headlines text-text-headings">
            {formatCurrency(item.grossUnitPrice ?? item.unitPrice, item.currency)}
          </span>
          {showNetUnderGross && item.netUnitPrice !== undefined && (
            <span className="text-sm font-body text-text-placeholders">
              {t('net')}: {formatCurrency(item.netUnitPrice, item.currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
