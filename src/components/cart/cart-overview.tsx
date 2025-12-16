'use client';

import { useRef } from 'react';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { H3 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/hooks/cart/useCart';
import useCustomer from '@/hooks/customer/useCustomer';
import { Cart } from '@/platform/services/model/cart/cart';
import { CartAction } from './cart-action';
import { CartDelivery } from './cart-delivery';
import { CartEmpty } from './cart-empty';
import { CartItemList } from './cart-itemlist';
import { CartSummary } from './cart-summary';

interface CartOverviewProps {
  initialCart?: Cart | null;
}

export function CartOverview({ initialCart }: CartOverviewProps) {
  const t = useTranslations('cart');
  const { cart, loading } = useCart(initialCart);
  const { customer } = useCustomer();

  const leftContent = useRef<HTMLDivElement>(null);

  if (loading && !cart) {
    return (
      <div className="max-w-6xl mx-auto mt-8">
        <Card className="mx-4 lg:mx-9">
          <CardHeader>
            <H3>{t('yourCart')}</H3>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Spinner variant="lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cart || cart.items.length == 0) {
    return <CartEmpty />;
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <div className="mx-4 lg:mx-9">
        <div className="flex gap-3 align-end mb-8">
          <H3>{t('title')}</H3>
          <div className="text-text-on-disabled text-lg m-0 leading-[2]">
            {cart.items.length > 1 ? cart.items.length + t('products') : cart.items.length + t('product')}
          </div>
        </div>
        <CartAction />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-11">
          <div className="col-span-1 lg:col-span-2" ref={leftContent}>
            {false && customer && <CartDelivery />}
            <CartItemList cart={cart} />
          </div>
          <CartSummary cart={cart} boundingContent={leftContent} />
        </div>
      </div>
    </div>
  );
}
