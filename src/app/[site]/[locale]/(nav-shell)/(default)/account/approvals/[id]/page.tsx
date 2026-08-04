import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { ApprovalDetails } from '@/components/account/approvals/approval-details';
import { getApprovalHref } from '@/components/account/approvals/approval-routing';
import { routing as intlRouting } from '@/i18n/routing';
import { getApprovalById } from '@/lib/ssr/approvals';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';
import { routing as siteRouting } from '@/site/routing';
import { addPrefixIfNeeded } from '@/site/utils';

const { getPathname } = createIntlNavigation(intlRouting);

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

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ site: string; locale: string; id: string }>;
}) {
  // Get approval ID and locale from params
  const { site, locale, id } = await params;

  // Get translations
  const [tAccount, tApproval, approval, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'orders.Approval' }),
    getApprovalById(id),
    getCurrentCustomer(),
  ]);

  // If approval not found, return 404
  if (!approval) {
    notFound();
  }

  // Reuse the shared approval routing decision (single source of truth with the
  // approvals table). A QUOTE approval is only redirected to its quote when the
  // viewer should see the quote (typically the requestor/owner). The designated
  // approver of a QUOTE approval — who cannot read the quote — is kept on this
  // page to review the approval details directly, avoiding a dead-end 403 redirect.
  const approvalHref = getApprovalHref(approval, customer?.id);
  if (approvalHref.startsWith('/account/quotes/')) {
    const quotePath = addPrefixIfNeeded(getPathname({ href: approvalHref, locale }), site, siteRouting, true);
    redirect(quotePath);
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
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
