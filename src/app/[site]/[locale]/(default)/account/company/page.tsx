import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { CompanyDetails } from '@/components/account/company/company-details';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('Company.title'), locale),
    description: t('Company.description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tAccount = await getTranslations({ locale, namespace: 'account' });

  const breadcrumbs = [
    { href: '/account', label: tAccount('accountDetails') },
    { href: '/account/company', label: tAccount('Company.title') },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <CompanyDetails />
    </AccountLayout>
  );
}
