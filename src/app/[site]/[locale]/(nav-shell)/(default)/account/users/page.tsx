import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import { UsersList } from '@/components/account/users/users-list';
import { getPageTitle } from '@/lib/ssr/seo';
import { getCompanyUsers, hasMultipleCompanies, requireB2bAdmin } from '@/lib/ssr/user-management';

const INITIAL_PAGE_SORT = 'firstName:asc';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
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

export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireB2bAdmin();
  const { locale } = await params;
  const [tAccount, tUserManagement, usersPage, showOtherCompaniesToggle] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'user-management' }),
    getCompanyUsers(1, USERS_PER_PAGE, INITIAL_PAGE_SORT),
    hasMultipleCompanies(),
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
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <UsersList
        initialUsers={usersPage?.items}
        initialTotalCount={usersPage?.totalCount}
        showOtherCompaniesToggle={showOtherCompaniesToggle}
      />
    </AccountLayout>
  );
}
