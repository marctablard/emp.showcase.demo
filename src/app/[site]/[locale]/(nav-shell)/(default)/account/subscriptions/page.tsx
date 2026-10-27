import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { SubscriptionsList } from '@/components/account/subscriptions/subscriptions-list';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';
import { CustomerRole } from '@/platform/services/model/customer/roles';

export const dynamic = 'force-dynamic';

async function subscriptionScope(): Promise<'mine' | 'company'> {
  const customer = await getCurrentCustomer();
  return customer?.roles?.includes(CustomerRole.B2B_ADMIN) === true ? 'company' : 'mine';
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.subscriptions' });
  const company = (await subscriptionScope()) === 'company';
  return {
    title: await getPageTitle(t(company ? 'companyTitle' : 'title'), locale),
    description: t(company ? 'companyDescription' : 'description'),
    robots: { index: false, follow: false },
  };
}

export default async function SubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tAccount = await getTranslations({ locale, namespace: 'account' });
  const t = await getTranslations({ locale, namespace: 'account.subscriptions' });
  const scope = await subscriptionScope();
  const company = scope === 'company';
  return (
    <AccountLayout
      breadcrumbs={[
        { href: '/account', label: tAccount('title') },
        { href: '/account/subscriptions', label: t(company ? 'companyTitle' : 'title') },
      ]}
    >
      <SubscriptionsList scope={scope} />
    </AccountLayout>
  );
}
