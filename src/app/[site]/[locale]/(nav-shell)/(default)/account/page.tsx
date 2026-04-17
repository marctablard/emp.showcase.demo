import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth/auth';
import { AccountLanding } from '@/components/account/account-landing';
import AccountDashboard from '@/components/account/dashboard/account-dashboard';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; site: string }>;
}): Promise<Metadata> {
  const session = await auth();
  const [{ locale }, t] = await Promise.all([params, getTranslations('account')]);
  if (!session?.user) {
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
  const session = await auth();

  if (!session || !session.user) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 lg:px-9">
        <AccountLanding />
      </div>
    );
  }

  return <AccountDashboard />;
}
