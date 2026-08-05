import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { redirect } from 'next/navigation';
import { routing as intlRouting } from '@/i18n/routing';
import { routing as siteRouting } from '@/site/routing';
import { addPrefixIfNeeded } from '@/site/utils';

const { getPathname } = createIntlNavigation(intlRouting);

/**
 * Legacy singular approval route.
 *
 * Consolidated into a site- and locale-preserving redirect to the canonical
 * plural route `/account/approvals/[id]`, which owns the approval detail page.
 */
export default async function LegacyApprovalDetailPage({
  params,
}: {
  params: Promise<{ site: string; locale: string; id: string }>;
}) {
  const { site, locale, id } = await params;

  const target = addPrefixIfNeeded(getPathname({ href: `/account/approvals/${id}`, locale }), site, siteRouting, true);

  redirect(target);
}
