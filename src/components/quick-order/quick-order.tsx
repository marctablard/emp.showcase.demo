'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FolderUp, Save, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCart } from '@/hooks/cart/useCart';
import { useQuickOrderList } from '@/hooks/quick-order/useQuickOrderList';
import type { QuickOrderItem } from '@/hooks/quick-order/useQuickOrderList';
import { useToast } from '@/hooks/ui/useToast';
import { useRouter } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import { QuickOrderFileUpload } from './quick-order-file-upload';
import { QuickOrderOverview } from './quick-order-overview';
import { QuickOrderProductList } from './quick-order-product-list';
import { QuickOrderSearch } from './quick-order-search';

export function QuickOrder() {
  const t = useTranslations('quick-order');
  const {
    items,
    addProducts,
    removeProduct,
    updateQuantity,
    clearAll,
    netSubtotal,
    grossSubtotal,
    vatTotal,
    currency,
  } = useQuickOrderList();

  const { addItem } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const logger = getLogger();

  const [isProcessing, setIsProcessing] = useState(false);

  const addItemsToCart = useCallback(
    async (currentItems: QuickOrderItem[]): Promise<{ succeeded: QuickOrderItem[]; failed: QuickOrderItem[] }> => {
      const succeeded: QuickOrderItem[] = [];
      const failed: QuickOrderItem[] = [];

      // Sequential to avoid cart API race conditions on concurrent mutations
      for (const item of currentItems) {
        try {
          await addItem(item.product.id, item.quantity);
          succeeded.push(item);
        } catch (error) {
          logger.error({ error, productId: item.product.id }, 'Failed to add item to cart');
          failed.push(item);
        }
      }

      return { succeeded, failed };
    },
    [addItem, logger],
  );

  const handleAddToCart = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { succeeded, failed } = await addItemsToCart(items);

      if (failed.length === 0) {
        toast({ title: t('notifications.addedToCart'), variant: 'success' });
        clearAll();
      } else {
        for (const item of succeeded) {
          removeProduct(item.product.id);
        }
        toast({
          title: t('notifications.addToCartPartialFailure', { failed: failed.length }),
          variant: 'destructive',
          persistent: true,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [items, addItemsToCart, toast, t, clearAll, removeProduct]);

  const handleGoToCheckout = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { succeeded, failed } = await addItemsToCart(items);

      if (failed.length === 0) {
        clearAll();
        router.push('/checkout');
      } else {
        for (const item of succeeded) {
          removeProduct(item.product.id);
        }
        toast({
          title: t('notifications.addToCartPartialFailure', { failed: failed.length }),
          variant: 'destructive',
          persistent: true,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  }, [items, addItemsToCart, clearAll, router, toast, t, removeProduct]);

  return (
    <div className="flex flex-col gap-8 min-w-0 ">
      <H1 className="mb-0">{t('title')}</H1>

      <Tabs defaultValue="manual" className="gap-0">
        <TabsList className="inline-flex h-auto w-full items-center justify-start gap-0 rounded-none border-b border-border-primary bg-transparent p-0">
          <TabsTrigger
            value="manual"
            className="cursor-pointer flex-none rounded-none border-0 border-b border-border-primary bg-transparent px-3 pb-3 pt-0 text-lg md:text-[28px] md:leading-[36px] font-headlines font-bold text-text-placeholders shadow-none data-[state=active]:border-b-2 data-[state=active]:border-border-action data-[state=active]:text-text-action data-[state=active]:shadow-none"
          >
            {t('tabs.productsSearch')}
          </TabsTrigger>
          <TabsTrigger
            value="bulk"
            className="cursor-pointer flex-none rounded-none border-0 border-b border-border-primary bg-transparent px-3 pb-3 pt-0 text-lg md:text-[28px] md:leading-[36px] font-headlines font-bold text-text-placeholders shadow-none data-[state=active]:border-b-2 data-[state=active]:border-border-action data-[state=active]:text-text-action data-[state=active]:shadow-none"
          >
            {t('tabs.bulkUpload')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <div data-testid="quick-order-manual-tab">
            <QuickOrderSearch onAddProducts={addProducts} />
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <div data-testid="quick-order-bulk-tab">
            <QuickOrderFileUpload onAddProducts={addProducts} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="flex flex-wrap gap-6">
            <Button
              variant="link"
              size="default"
              disabled
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('quickLinks.saveOrderList')}
              <Save />
            </Button>
            <Button
              variant="link"
              size="default"
              disabled
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('quickLinks.loadOrderList')}
              <FolderUp />
            </Button>
            <Button
              variant="link"
              size="default"
              disabled
              className="normal-case text-base tracking-normal p-0 gap-1 underline justify-start"
            >
              {t('quickLinks.share')}
              <Share2 />
            </Button>
          </div>

          <QuickOrderProductList items={items} onRemoveProduct={removeProduct} onUpdateQuantity={updateQuantity} />
        </div>

        <div className="md:w-[438px] md:shrink-0">
          <QuickOrderOverview
            items={items}
            netSubtotal={netSubtotal}
            grossSubtotal={grossSubtotal}
            vatTotal={vatTotal}
            currency={currency}
            onAddToCart={handleAddToCart}
            onGoToCheckout={handleGoToCheckout}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}
