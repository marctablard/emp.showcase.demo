import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { QuickOrder } from '@/components/quick-order/quick-order';
import { UiBreadcrumb } from '@/components/ui/molecules/ui-breadcrumb';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'quick-order' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function QuickOrderPage() {
  const t = await getTranslations('quick-order');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mx-4 lg:mx-9">
        <UiBreadcrumb items={[{ href: '/quick-order', label: t('title') }]} className="pb-4 pt-4 sm:pt-0" />
        <QuickOrder />
      </div>
    </div>
  );
}
