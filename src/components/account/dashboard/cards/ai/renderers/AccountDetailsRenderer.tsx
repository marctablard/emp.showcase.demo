'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { AccountDetailsData } from '../types';
import { formatDateTime } from '../utils';
import {
  AiAddressList,
  AiSectionLabel,
  AiSpecGrid,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
} from './ai-widget-kit';

interface AccountDetailsRendererProps {
  data: AccountDetailsData;
}

export const AccountDetailsRenderer: React.FC<AccountDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const personalInfo = data.personalInfo;
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];

  if (personalInfo == null && addresses.length === 0) {
    return <p className="px-1 text-sm text-text-placeholders">{t('noDataAvailable')}</p>;
  }

  return (
    <AiWidgetFrame>
      {personalInfo ? (
        <>
          <AiWidgetHeader
            eyebrow={t('accountInformation')}
            title={personalInfo.name || personalInfo.email}
            meta={[personalInfo.company, personalInfo.customerNumber]}
          />
          <AiWidgetSection>
            <AiSpecGrid
              entries={[
                { key: 'email', label: t('email'), value: personalInfo.email },
                { key: 'businessModel', label: t('businessModel'), value: personalInfo.businessModel },
                { key: 'language', label: t('preferredLanguage'), value: personalInfo.preferredLanguage },
                { key: 'currency', label: t('preferredCurrency'), value: personalInfo.preferredCurrency },
                { key: 'site', label: t('preferredSite'), value: personalInfo.preferredSite },
                {
                  key: 'lastLogin',
                  label: t('lastLogin'),
                  value: personalInfo.lastLogin ? formatDateTime(personalInfo.lastLogin) : undefined,
                },
              ]}
            />
          </AiWidgetSection>
        </>
      ) : null}

      {addresses.length > 0 ? (
        <section className={personalInfo ? 'border-t border-border-primary' : undefined}>
          <AiSectionLabel className="mb-0 px-4 pt-3">{t('savedAddresses')}</AiSectionLabel>
          <AiAddressList addresses={addresses} />
        </section>
      ) : null}
    </AiWidgetFrame>
  );
};
