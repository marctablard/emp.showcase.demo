import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { UserDetailsForm } from '@/components/account/users/user-details-form';
import { getPageTitle } from '@/lib/ssr/seo';
import { getCompanyUserById, getHeaderCompanies, requireB2bAdmin } from '@/lib/ssr/user-management';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
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

export default async function EditUserPage({ params }: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  await requireB2bAdmin();
  const { locale, id } = await params;
  const [tAccount, tUserManagement, user, headerCompanies] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'user-management' }),
    getCompanyUserById(id),
    getHeaderCompanies(),
  ]);

  if (!user) {
    notFound();
  }

  const displayName = [user.firstName.trim(), user.lastName.trim()].filter((part) => part.length > 0).join(' ');
  const breadcrumbName = displayName || user.id;

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
      href: `/account/users/${id}`,
      label: tUserManagement('breadcrumbEditUser', { name: breadcrumbName }),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <UserDetailsForm initialUser={user} headerCompanies={headerCompanies} />
    </AccountLayout>
  );
}
