'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, FolderUp, Save, Share2 } from 'lucide-react';
import { Button } from '../ui/button';
import UiLink from '../ui/link';

export function CartAction() {
  const t = useTranslations('cart');

  return (
    <div className="grid grid-cols-1 md:grid-cols-10 lg:grid-cols-3">
      <div className="col-span-1 md:col-span-6 lg:col-span-2">
        <div className="flex flex-wrap justify-between mb-4 gap-4 sm:gap-1">
          <div className="flex flex-wrap gap-1 sm:gap-6">
            <Button
              variant="link"
              size="default"
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('saveCart')}
              <Save />
            </Button>
            <Button
              variant="link"
              size="default"
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('loadCart')}
              <FolderUp />
            </Button>
            <Button
              variant="link"
              size="default"
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('share')}
              <Share2 />
            </Button>
          </div>
          <UiLink type="Link" href="/" variant="primary" size="m" iconAfter={<ArrowRight />}>
            {t('backToShop')}
          </UiLink>
        </div>
      </div>
    </div>
  );
}
