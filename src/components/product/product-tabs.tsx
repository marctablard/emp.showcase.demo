import React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Product } from '@/platform/services/model/product';

interface ProductTabsComponentProps {
  product: Product;
}

export function ProductTabsComponent({ product }: ProductTabsComponentProps) {
  const t = useTranslations('product');
  const tabsT = useTranslations('product.tabs');

  return (
    <div className="mt-8">
      <Tabs defaultValue="description">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="description">{tabsT('description')}</TabsTrigger>
          <TabsTrigger value="specs">{tabsT('specs')}</TabsTrigger>
          <TabsTrigger value="downloads">{tabsT('downloads')}</TabsTrigger>
          <TabsTrigger value="reviews">{tabsT('reviews')}</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="text-text-body">
          {product.description ? (
            <div className="mb-4" dangerouslySetInnerHTML={{ __html: product.description }} />
          ) : (
            <p className="mb-4">{t('noDescription')}</p>
          )}
        </TabsContent>
        <TabsContent value="specs" className="text-text-body">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </TabsContent>
        <TabsContent value="downloads" className="text-text-body">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </TabsContent>
        <TabsContent value="reviews" className="text-text-body">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
