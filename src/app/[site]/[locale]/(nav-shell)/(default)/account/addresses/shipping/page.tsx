import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { AddressesList } from '@/components/account/addresses/address-card';
import { H1 } from '@/components/ui/h';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('shippingAddresses'), locale),
    description: t('shippingAddressesDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ShippingAddressesPage({ params }: { params: Promise<{ locale: string }> }) {
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
      href: '/account/addresses/shipping',
      label: tAccount('shippingAddresses'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto py-6">
        <H1 variant="h6" className="mb-6">
          {tAccount('shippingAddresses')}
        </H1>
        <p className="text-text-placeholders mb-8">{tAccount('manageShippingAddresses')}</p>

        {/* Client-side component for displaying and managing addresses */}
        <AddressesList type="SHIPPING" />
      </div>
    </AccountLayout>
  );
}
