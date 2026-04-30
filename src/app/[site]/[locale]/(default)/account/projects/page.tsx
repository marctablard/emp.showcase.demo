import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { ProjectsList } from '@/components/account/projects/projects-list';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('projects.title'), locale),
    description: t('projects.description'),
    robots: { index: false, follow: false },
  };
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  const breadcrumbs = [
    { href: '/account', label: t('accountDetails') },
    { href: '/account/projects', label: t('projects.title') },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ProjectsList />
    </AccountLayout>
  );
}
