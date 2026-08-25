import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { UserDetailsForm } from '@/components/account/users/user-details-form';
import { getPageTitle } from '@/lib/ssr/seo';
import { requireSelectedCompanyAdmin } from '@/lib/ssr/user-management';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'user-management' });

  return {
    title: await getPageTitle(t('heading'), locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function NewUserPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  await requireSelectedCompanyAdmin();
  const { locale } = await params;
  const [tAccount, tUserManagement] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'user-management' }),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/users',
      label: tUserManagement('heading'),
    },
    {
      href: '/account/users/new',
      label: tUserManagement('breadcrumbUserCreation'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <UserDetailsForm />
    </AccountLayout>
  );
}
