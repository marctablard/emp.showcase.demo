'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Bot, CheckCircle2, ClipboardCheck, HandHelping, LineChart, Package, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { H5, Heading } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import useAuthDialog from '@/hooks/authentication/useAuthDialog';

const benefits = [
  {
    icon: Package,
    key: 'trackOrders',
  },
  {
    icon: Bot,
    key: 'aiAssistant',
  },
  {
    icon: HandHelping,
    key: 'supportTickets',
  },
  {
    icon: Percent,
    key: 'quotes',
  },
  {
    icon: ClipboardCheck,
    key: 'approvals',
  },
  {
    icon: LineChart,
    key: 'insights',
  },
];

export function AccountLanding() {
  const t = useTranslations('account.landing');
  const { openDialog } = useAuthDialog();

  return (
    <div className="py-8 md:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12 md:mb-16">
        <Heading variant="h1" className="mb-4">
          {t('title')}
        </Heading>
        <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto">{t('subtitle')}</p>
      </div>
      {/* CTA Section */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl py-8 md:p-12 text-center">
        <Heading variant="h3" className="mb-6">
          {t('cta.registerSubtext')}
        </Heading>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button onClick={() => openDialog('login')} className="w-full sm:w-auto">
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {t('cta.login')}
          </Button>
          <UiLink type="Link" variant="buttonSecondary" href="/register" className="w-full sm:w-auto">
            {t('cta.register')}
          </UiLink>
        </div>
      </div>
      {/* Benefits Grid */}
      <div className="mb-12 md:mb-16">
        <Heading variant="h2" className="text-center mb-8 md:mb-12">
          {t('benefits.title')}
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {benefits.map(({ icon: Icon, key }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-6 w-6" />
                  <H5>{t(`benefits.${key}.title`)}</H5>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{t(`benefits.${key}.description`)}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
