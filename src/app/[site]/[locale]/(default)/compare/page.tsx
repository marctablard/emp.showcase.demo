import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getPageTitle } from '@/lib/ssr/seo';
import { CompareView } from './compare-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'comparison' });

  return {
    title: await getPageTitle(t('title'), locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ComparePage() {
  return <CompareView />;
}
