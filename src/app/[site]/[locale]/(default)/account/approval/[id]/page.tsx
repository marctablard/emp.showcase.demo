import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { ApprovalDetails } from '@/components/account/approvals/approval-details.quote';
import { getApprovalById } from '@/lib/ssr/approvals';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'orders.Approval' });

  return {
    title: await getPageTitle(t('approvalDetails') + ' #' + id, locale),
    description: t('approvalDetailsDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ApprovalDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;

  const [tAccount, tApproval, approval, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'orders.Approval' }),
    getApprovalById(id),
    getCurrentCustomer(),
  ]);

  if (!approval) {
    notFound();
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('title'),
    },
    {
      href: '/account/approvals',
      label: tApproval('approvals'),
    },
    {
      href: `/account/approval/${id}`,
      label: `${tApproval('approval')} #${id}`,
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ApprovalDetails approvalId={id} initialApproval={approval} currentUserId={customer?.id} />
    </AccountLayout>
  );
}
