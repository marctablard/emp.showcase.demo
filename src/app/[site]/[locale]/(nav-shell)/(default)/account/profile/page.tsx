import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import ProfileEditForm from '@/components/account/profile/profile-edit-form';
import { AccountPageHeader } from '@/components/account/shared/account-page-header';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('profile.title'), locale),
    description: t('profile.description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  const customer = await getCurrentCustomer();

  return (
    <AccountLayout>
      <div className="max-w-4xl space-y-6">
        <AccountPageHeader
          eyebrow={t('sidebar.groups.myAccount')}
          title={t('sidebar.items.personalData')}
          description={t('profile.description')}
        />
        <ProfileEditForm customer={customer || null} />
      </div>
    </AccountLayout>
  );
}
