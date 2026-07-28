import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { WishlistView } from '@/components/account/wishlist/wishlist-view';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.wishlist' });
  return {
    title: await getPageTitle(t('title'), locale),
    robots: { index: false, follow: false },
  };
}

export default async function WishlistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tAccount = await getTranslations({ locale, namespace: 'account' });
  const tWishlist = await getTranslations({ locale, namespace: 'account.wishlist' });

  const breadcrumbs = [
    { href: '/account', label: tAccount('accountDetails') },
    { href: '/account/wishlists', label: tWishlist('breadcrumb') },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <WishlistView />
    </AccountLayout>
  );
}
