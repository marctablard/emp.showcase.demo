import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { QuoteDetails } from '@/components/account/quotes/quote-details';
import { getQuoteById } from '@/lib/ssr/quotes';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'account.quoteDetails' });

  return {
    title: await getPageTitle(t('title') + ' #' + id, locale),
    description: t('title'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  // Get quote ID from params
  const { locale, id } = await params;

  // Get translations
  const [tAccount, tQuote, tQuotes, quote] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.quoteDetails' }),
    getTranslations({ locale, namespace: 'account.quotesList' }),
    getQuoteById(id),
  ]);

  // If quote not found, return 404
  if (!quote) {
    notFound();
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/quotes',
      label: tQuotes('title'),
    },
    {
      href: `/account/quotes/${id}`,
      label: `${tQuote('headerTitle')} ${id}`,
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <QuoteDetails quoteId={id} initialQuote={quote} />
    </AccountLayout>
  );
}
