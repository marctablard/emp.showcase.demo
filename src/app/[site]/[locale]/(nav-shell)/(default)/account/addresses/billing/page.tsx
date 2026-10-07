import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { AddressesList } from '@/components/account/addresses/address-card';
import { AccountPageHeader } from '@/components/account/shared/account-page-header';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('billingAddresses'), locale),
    description: t('billingAddressesDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function BillingAddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  // Get translations
  const { locale } = await params;
  const [tAccount] = await Promise.all([getTranslations({ locale, namespace: 'account' })]);

  // Set up breadcrumbs for navigation
  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/addresses/billing',
      label: tAccount('billingAddresses'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <AccountPageHeader title={tAccount('billingAddresses')} description={tAccount('manageBillingAddresses')} />

        {/* Client-side component for displaying and managing addresses */}
        <AddressesList type="BILLING" />
      </div>
    </AccountLayout>
  );
}
