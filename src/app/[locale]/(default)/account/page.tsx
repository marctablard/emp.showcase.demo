import React from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AccountDashboard from '@/components/account/dashboard/account-dashboard';
import { redirect } from '@/i18n/navigation';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('accountDashboardDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  // Get translations and current customer
  const { locale } = await params;
  const [customer] = await Promise.all([getCurrentCustomer()]);
  if (!customer) {
    redirect({ href: '/login', locale });
    return;
  }
  return <AccountDashboard customer={customer} />;
}
