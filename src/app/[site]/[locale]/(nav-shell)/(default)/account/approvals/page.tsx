import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { APPROVALS_PER_PAGE } from '@/components/account/account-table-constants';
import { ApprovalsList } from '@/components/account/approvals/approvals-list';
import { getApprovals } from '@/lib/ssr/approvals';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

const INITIAL_PAGE_SORT = 'metadata.modifiedAt:desc';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders.Approval' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('approvalsListDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  // Fetch approvals data during SSR
  const { locale } = await params;
  const [tAccount, tApproval, approvalsPage, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'orders.Approval' }),
    getApprovals(1, APPROVALS_PER_PAGE, INITIAL_PAGE_SORT),
    getCurrentCustomer(),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/approvals',
      label: tApproval('title'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ApprovalsList
        initialApprovals={approvalsPage?.items}
        initialTotalCount={approvalsPage?.totalCount}
        currentUserId={customer?.id}
      />
    </AccountLayout>
  );
}
