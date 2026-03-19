import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { DevicesList } from '@/components/account/devices/devices-list';
import { getDevices } from '@/lib/ssr/devices';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.devices' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function DevicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [tAccount, tDevices, devices] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.devices' }),
    getDevices(),
  ]);

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('title'),
    },
    {
      href: '/account/devices',
      label: tDevices('title'),
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <DevicesList initialDevices={devices} />
    </AccountLayout>
  );
}
