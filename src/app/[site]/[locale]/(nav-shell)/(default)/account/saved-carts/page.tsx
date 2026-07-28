import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountLayout } from '@/components/account/account-layout';
import { SavedCartsList } from '@/components/account/saved-carts/saved-carts-list';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart.savedCarts' });

  return {
    title: t('title'),
  };
}

export default async function SavedCartsPage() {
  const t = await getTranslations('cart.savedCarts');

  return (
    <AccountLayout>
      <SavedCartsList title={t('title')} className="w-full" />
    </AccountLayout>
  );
}
