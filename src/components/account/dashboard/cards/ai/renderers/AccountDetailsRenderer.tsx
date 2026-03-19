'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AccountDetailsData, AddressData } from '../types';
import { formatDateTime } from '../utils';
import { AddressCard } from './AddressCard';

interface AccountDetailsRendererProps {
  data: AccountDetailsData;
}

export const AccountDetailsRenderer: React.FC<AccountDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');

  return (
    <div className="space-y-4">
      {data.personalInfo && (
        <div className="bg-surface-primary rounded-lg border border-border-primary p-4">
          <div className="flex items-center space-x-2 mb-4">
            <h3 className="text-base font-semibold text-text-headings">{t('accountInformation')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">👤</div>
              <div>
                <div className="text-xs text-text-body">{t('name')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.name}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">✉️</div>
              <div>
                <div className="text-xs text-text-body">{t('email')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.email}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">🏢</div>
              <div>
                <div className="text-xs text-text-body">{t('company')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.company}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">💳</div>
              <div>
                <div className="text-xs text-text-body">{t('customerNumber')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.customerNumber}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">🌐</div>
              <div>
                <div className="text-xs text-text-body">{t('businessModel')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.businessModel}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">Az</div>
              <div>
                <div className="text-xs text-text-body">{t('preferredLanguage')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.preferredLanguage}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">$</div>
              <div>
                <div className="text-xs text-text-body">{t('preferredCurrency')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.preferredCurrency}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">📍</div>
              <div>
                <div className="text-xs text-text-body">{t('preferredSite')}</div>
                <div className="text-sm font-medium text-text-headings">{data.personalInfo.preferredSite || '-'}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 text-text-body">🕐</div>
              <div>
                <div className="text-xs text-text-body">{t('lastLogin')}</div>
                <div className="text-sm font-medium text-text-headings">
                  {formatDateTime(data.personalInfo.lastLogin)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.addresses && data.addresses.length > 0 && (
        <div className="bg-surface-primary rounded-lg border border-border-primary p-4">
          <div className="flex items-center space-x-2 mb-4">
            <h3 className="text-base font-semibold text-text-headings">{t('savedAddresses')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
            {data.addresses.map((address: AddressData, index: number) => (
              <AddressCard key={index} address={address} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
