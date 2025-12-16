import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import ProfileEditForm from '@/components/account/profile/profile-edit-form';
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

export default async function ProfilePage() {
  const customer = await getCurrentCustomer();

  return (
    <AccountLayout>
      <div className="max-w-4xl mx-auto py-6">
        <ProfileEditForm customer={customer || null} />
      </div>
    </AccountLayout>
  );
}
