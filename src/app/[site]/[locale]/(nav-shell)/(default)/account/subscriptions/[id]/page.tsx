import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { SubscriptionDetail } from '@/components/account/subscriptions/subscription-detail';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.subscriptions' });
  return {
    title: await getPageTitle(t('title'), locale),
    robots: { index: false, follow: false },
  };
}

export default async function SubscriptionPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const tAccount = await getTranslations({ locale, namespace: 'account' });
  const t = await getTranslations({ locale, namespace: 'account.subscriptions' });
  return (
    <AccountLayout
      breadcrumbs={[
        { href: '/account', label: tAccount('title') },
        { href: '/account/subscriptions', label: t('title') },
        { href: `/account/subscriptions/${id}`, label: id },
      ]}
    >
      <SubscriptionDetail id={id} />
    </AccountLayout>
  );
}
