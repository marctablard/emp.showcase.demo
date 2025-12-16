import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountLanding } from '@/components/account/account-landing';
import AccountDashboard from '@/components/account/dashboard/account-dashboard';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; site: string }>;
}): Promise<Metadata> {
  const [{ locale }, customer, t] = await Promise.all([params, getCurrentCustomer(), getTranslations('account')]);
  if (!customer) {
    return {
      title: await getPageTitle(t('landing.title'), locale),
      description: t('landing.subtitle'),
      robots: {
        index: true,
        follow: true,
      },
    };
  }
  return {
    title: await getPageTitle(t('title'), locale),
    description: t('accountDashboardDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AccountPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 lg:px-9">
        <AccountLanding />
      </div>
    );
  }

  return <AccountDashboard customer={customer} />;
}
