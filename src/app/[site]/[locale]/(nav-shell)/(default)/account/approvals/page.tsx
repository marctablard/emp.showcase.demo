import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { ApprovalsList } from '@/components/account/approvals/approvals-list';
import { getApprovals } from '@/lib/ssr/approvals';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders.Approval' });

  return {
    title: await getPageTitle(t('approvals'), locale),
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
  const [tAccount, tApproval, approvals, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'orders.Approval' }),
    getApprovals(),
    getCurrentCustomer(),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('title'),
    },
    {
      href: '/account/approvals',
      label: tApproval('approvals'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ApprovalsList initialApprovals={approvals} currentUserId={customer?.id} />
    </AccountLayout>
  );
}
