import { createNavigation as createIntlNavigation } from 'next-intl/navigation';
import { redirect } from 'next/navigation';
import { routing as intlRouting } from '@/i18n/routing';
import { routing as siteRouting } from '@/site/routing';
import { addPrefixIfNeeded } from '@/site/utils';

const { getPathname } = createIntlNavigation(intlRouting);

/** Company subscriptions are the Subscriptions page for a company admin. */
export default async function CompanySubscriptionsPage({
  params,
}: {
  params: Promise<{ site: string; locale: string }>;
}) {
  const { site, locale } = await params;
  const target = addPrefixIfNeeded(getPathname({ href: '/account/subscriptions', locale }), site, siteRouting, true);
  redirect(target);
}
