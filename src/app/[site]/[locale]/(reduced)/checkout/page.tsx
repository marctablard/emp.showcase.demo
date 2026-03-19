import React from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Checkout from '@/components/checkout/checkout';
import { getCurrentCart } from '@/lib/ssr/carts';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

interface CheckoutPageProps {
  locale: string;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}
export default async function CheckoutPage({ params }: { params: Promise<CheckoutPageProps> }) {
  const { locale: _locale } = await params;
  const cart = await getCurrentCart();

  // Redirect to cart page if no cart exists or cart is empty
  if (!cart || cart.items.length === 0) {
    redirect('/cart');
  }
  return <Checkout />;
}
