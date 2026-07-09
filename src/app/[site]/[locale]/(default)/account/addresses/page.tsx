import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { AddressesList } from '@/components/account/addresses/address-card';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountSectionBar,
} from '@/components/account/shared/account-detail';
import { getPageTitle } from '@/lib/ssr/seo';

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
      <AccountDetailContainer>
        <AccountDetailHeader eyebrow={tAccount('sidebar.groups.myOrganisation')} title={tAccount('Address.title')} />

        {/* Billing Addresses Section */}
        <section className="border-b border-border-primary">
          <AccountSectionBar>{tAccount('Address.billingAddresses')}</AccountSectionBar>
          <div className="px-4 py-4 sm:px-6">
            <p className="mb-4 text-sm text-text-placeholders">{tAccount('Address.manageBillingAddresses')}</p>
            <AddressesList type="BILLING" />
          </div>
        </section>

        {/* Shipping Addresses Section */}
        <section>
          <AccountSectionBar>{tAccount('Address.shippingAddresses')}</AccountSectionBar>
          <div className="px-4 py-4 sm:px-6">
            <p className="mb-4 text-sm text-text-placeholders">{tAccount('Address.manageShippingAddresses')}</p>
            <AddressesList type="SHIPPING" />
          </div>
        </section>
      </AccountDetailContainer>
    </AccountLayout>
  );
}
