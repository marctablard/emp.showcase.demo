import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountLayout } from '@/components/account/account-layout';
import { SubscriptionsList } from '@/components/account/subscriptions/subscriptions-list';
import { redirect } from '@/i18n/navigation';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.Subscriptions' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tAccount = await getTranslations({ locale, namespace: 'account' });

  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect({ href: '/login', locale });
    return;
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/subscriptions',
      label: tAccount('sidebar.items.subscriptions'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <SubscriptionsList />
    </AccountLayout>
  );
}
