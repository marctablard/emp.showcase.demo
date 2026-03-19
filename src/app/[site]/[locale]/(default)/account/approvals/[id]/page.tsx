import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { ApprovalDetails } from '@/components/account/approvals/approval-details';
import { getApprovalById } from '@/lib/ssr/approvals';
import { getPageTitle } from '@/lib/ssr/seo';

// Force dynamic rendering for personalized content

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
  // Get approval ID and locale from params
  const { locale, id } = await params;

  // Get translations
  const [tAccount, tApproval, approval] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'orders.Approval' }),
    getApprovalById(id),
  ]);

  // If approval not found, return 404
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
      href: `/account/approvals/${id}`,
      label: `${tApproval('approval')} #${id}`,
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ApprovalDetails approvalId={id} initialApproval={approval} />
    </AccountLayout>
  );
}
