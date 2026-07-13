import { getTranslations } from 'next-intl/server';
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

export default async function QuotesPage() {
  const quotes = await getQuotes();
  return <QuotesPageContent initialQuotes={quotes ?? undefined} />;
}
