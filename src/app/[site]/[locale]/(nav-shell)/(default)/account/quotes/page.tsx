import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { QUOTES_PER_PAGE } from '@/components/account/account-table-constants';
import QuotesPageContent from '@/components/account/quotes/quotes-page';
import { getQuotes } from '@/lib/ssr/quotes';
import { getPageTitle } from '@/lib/ssr/seo';

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.quotesList' });

  return {
    title: await getPageTitle(t('title'), locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

const INITIAL_PAGE_SORT = 'metadata.createdAt:DESC';

export default async function QuotesPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const [tAccount, tQuotes, quotesPage] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.quotesList' }),
    getQuotes(QUOTES_PER_PAGE, 0, INITIAL_PAGE_SORT),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/quotes',
      label: tQuotes('title'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <QuotesPageContent initialQuotes={quotesPage?.items} initialTotalCount={quotesPage?.totalCount} />
    </AccountLayout>
  );
}
