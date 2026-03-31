import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CartOverview } from '@/components/cart/cart-overview';
import { getCurrentCart } from '@/lib/ssr/carts';
import { getPageTitle } from '@/lib/ssr/seo';
import { isCartSsrEnabled } from '@/lib/ssr/ssr-config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });

  return {
    title: await getPageTitle(t('yourCart'), locale),
    description: t('orderSummary'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CartPage() {
  const cart = isCartSsrEnabled() ? await getCurrentCart() : undefined;
  return <CartOverview initialCart={cart} />;
}
