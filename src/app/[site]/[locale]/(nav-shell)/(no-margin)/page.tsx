import { setRequestLocale } from 'next-intl/server';
import CmsPage from '@/components/cms/_core/cms-page';
import { StaticHomePage } from '@/components/cms/_core/static-home-page';
import { usesStaticHomepage } from '@/lib/cms/static-home';
import { setRequestSite } from '@/site/server/';

export default async function Home({ params }: { params: Promise<{ locale: string; site: string }> }) {
  const { locale, site } = await params;
  setRequestSite(site);
  setRequestLocale(locale);
  if (usesStaticHomepage()) {
    return <StaticHomePage locale={locale} />;
  }
  return <CmsPage slug="home" locale={locale} site={site} emptyOnNoResult={true} />;
}
