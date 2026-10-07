import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { ProjectDetail } from '@/components/account/projects/project-detail';
import { Spinner } from '@/components/ui/spinner';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('projects.title'), locale),
    robots: { index: false, follow: false },
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  const breadcrumbs = [
    { href: '/account', label: t('accountDetails') },
    { href: '/account/projects', label: t('projects.title') },
    { href: `/account/projects/${id}`, label: '...' },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner variant="lg" />
          </div>
        }
      >
        <ProjectDetail projectId={id} />
      </Suspense>
    </AccountLayout>
  );
}
