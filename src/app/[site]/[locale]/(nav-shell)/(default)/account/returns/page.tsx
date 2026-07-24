import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { ReturnsList } from '@/components/account/returns/returns-list';
import { getReturnsPage } from '@/lib/ssr/returns';
import { getPageTitle } from '@/lib/ssr/seo';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.returns' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ReturnsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const initialPageSize = 5;
  const initialSort = 'metadata.createdAt:DESC';
  const { locale } = await params;
  const [tAccount, tReturns, returnsPage] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.returns' }),
    getReturnsPage(1, initialPageSize, initialSort),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/returns',
      label: tReturns('title'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ReturnsList initialReturns={returnsPage?.items} initialTotalCount={returnsPage?.totalCount} />
    </AccountLayout>
  );
}
