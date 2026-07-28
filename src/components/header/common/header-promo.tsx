import { useId } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import UiLink from '@/components/ui/link';
import { cn } from '@/lib/utils';

interface HeaderPromoProps {
  className?: string;
}

export function HeaderPromo({ className }: HeaderPromoProps) {
  const baseId = useId();
  const promos = [
    {
      title: 'Promo 1',
    },
    {
      title: 'Promo 2',
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 gap-2 m-5 sm:m-0', className)}>
      {promos.map((promo, index) => (
        <div
          key={index}
          className="flex w-full flex-col items-center justify-between rounded-sm bg-surface-image-background p-2 sm:p-4"
        >
          <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-sm bg-surface-action-hover-2 sm:mb-4">
            <Image src="/images/img_placeholder.png" alt={promo.title} fill sizes="50vw" className="object-cover" />
          </div>
          <div className="flex w-full flex-wrap gap-2 justify-between">
            <p className="text-text-body font-bold" id={`${baseId}-promo-${index}`}>
              {promo.title}
            </p>
            <UiLink
              type="A"
              variant="buttonPrimary"
              href="#"
              className="ms-auto"
              aria-labelledby={`${baseId}-promo-${index}`}
            >
              <ArrowRight />
            </UiLink>
          </div>
        </div>
      ))}
    </div>
  );
}
