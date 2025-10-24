import React from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { AiHelperCard } from '@/components/account/dashboard/cards/ai-helper-card';
import { getCurrentCustomer } from '@/lib/ssr/customer';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle('Emporix AI Agent', locale),
    description: 'AI-powered assistant for your business needs',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AIAgentPage({ params }: { params: Promise<{ locale: string }> }) {
  // Get translations and current customer
  const { locale } = await params;
  const [customer, tAccount] = await Promise.all([
    getCurrentCustomer(),
    getTranslations({ locale, namespace: 'account' }),
  ]);
  if (!customer) {
    redirect({ href: '/login', locale });
    return;
  }

  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/ai-agent',
      label: 'Emporix AI Agent',
    },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Emporix AI Agent</h1>
          <p className="text-gray-600 mt-2">Your intelligent assistant for business operations and support</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm">
          <AiHelperCard className="h-auto min-h-[600px]" />
        </div>
      </div>
    </AccountLayout>
  );
}
