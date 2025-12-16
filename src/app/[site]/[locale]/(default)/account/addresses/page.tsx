import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { AddressesList } from '@/components/account/addresses/address-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H1 } from '@/components/ui/h';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('Address.title'), locale),
    description: t('Address.description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
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
      href: '/account/addresses',
      label: tAccount('Address.title'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <div className="container mx-auto py-6">
        <H1 variant="h6" className="mb-6">
          {tAccount('Address.title')}
        </H1>
        <p className="text-text-placeholders mb-8">{tAccount('Address.description')}</p>

        <div className="grid gap-8">
          {/* Billing Addresses Section */}
          <Card>
            <CardHeader>
              <CardTitle>{tAccount('Address.billingAddresses')}</CardTitle>
              <p className="text-text-placeholders">{tAccount('Address.manageBillingAddresses')}</p>
            </CardHeader>
            <CardContent>
              <AddressesList type="BILLING" />
            </CardContent>
          </Card>

          {/* Shipping Addresses Section */}
          <Card>
            <CardHeader>
              <CardTitle>{tAccount('Address.shippingAddresses')}</CardTitle>
              <p className="text-text-placeholders">{tAccount('Address.manageShippingAddresses')}</p>
            </CardHeader>
            <CardContent>
              <AddressesList type="SHIPPING" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AccountLayout>
  );
}
