import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { ReturnDetail } from '@/components/account/returns/return-detail';
import { getReturnById } from '@/lib/ssr/returns';
import { getPageTitle } from '@/lib/ssr/seo';

// Force dynamic rendering for personalized content
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'account.returns' });

  return {
    title: await getPageTitle(t('returnDetails') + ' #' + id, locale),
    description: t('returnDetailsDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;

  const [tAccount, tReturns, apiReturn] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.returns' }),
    getReturnById(id),
  ]);

  if (!apiReturn) {
    notFound();
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('title'),
    },
    {
      href: '/account/returns',
      label: tReturns('title'),
    },
    {
      href: `/account/returns/${id}`,
      label: `${tReturns('returnLabel')} #${id}`,
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <ReturnDetail returnId={id} initialReturn={apiReturn} />
    </AccountLayout>
  );
}
