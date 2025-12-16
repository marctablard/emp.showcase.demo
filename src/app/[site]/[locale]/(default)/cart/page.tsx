import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CartOverview } from '@/components/cart/cart-overview';
import { getCurrentCart } from '@/lib/ssr/carts';
import { getPageTitle } from '@/lib/ssr/seo';

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
  const cart = await getCurrentCart();

  return <CartOverview initialCart={cart} />;
}
