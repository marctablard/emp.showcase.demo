import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { AddressesList } from '@/components/account/addresses/address-card';
import { H1 } from '@/components/ui/h';
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
      <div className="container mx-auto py-6">
        <H1 variant="h6" className="mb-6">
          {tAccount('billingAddresses')}
        </H1>
        <p className="text-text-placeholders mb-8">{tAccount('manageBillingAddresses')}</p>

        {/* Client-side component for displaying and managing addresses */}
        <AddressesList type="BILLING" />
      </div>
    </AccountLayout>
  );
}
