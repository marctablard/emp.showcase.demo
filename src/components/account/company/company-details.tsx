'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, MapPin, Pencil } from 'lucide-react';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import { AddressDisplay } from '@/components/common/address-display';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useCompanyDetails } from '@/hooks/company/useCompanyDetails';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { Link } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { CompanyDetails as CompanyDetailsModel } from '@/platform/services/model/company/company';
import { CustomerRole } from '@/platform/services/model/customer/roles';

type CompanyFormState = {
  name: string;
  legalName: string;
  taxRegistrationNumber: string;
  registrationId: string;
  registrationAgency: string;
  countryOfRegistration: string;
};

const ONBOARDING_BADGE: Record<'approved' | 'pending' | 'rejected', BadgeVariant> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'destructive',
};

function toFormState(company: CompanyDetailsModel): CompanyFormState {
  return {
    name: company.name ?? '',
    legalName: company.legalInfo?.legalName ?? '',
    taxRegistrationNumber: company.legalInfo?.taxRegistrationNumber ?? '',
    registrationId: company.legalInfo?.registrationId ?? '',
    registrationAgency: company.legalInfo?.registrationAgency ?? '',
    countryOfRegistration: company.legalInfo?.countryOfRegistration ?? '',
  };
}

export function CompanyDetails() {
  const t = useTranslations('account.Company');
  const { toast } = useToast();
  const { company, loading, error, fetchCompany, updateCompany } = useCompanyDetails();
  const { customer } = useCustomer();

  const isAdmin = !!customer?.roles?.includes(CustomerRole.B2B_ADMIN);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<CompanyFormState | null>(null);

  useEffect(() => {
    if (company) {
      setForm(toFormState(company));
    }
  }, [company]);

  const setField = (key: keyof CompanyFormState, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setIsSaving(true);
    try {
      await updateCompany({
        name: form.name.trim(),
        legalInfo: {
          legalName: form.legalName.trim() || undefined,
          taxRegistrationNumber: form.taxRegistrationNumber.trim() || undefined,
          registrationId: form.registrationId.trim() || undefined,
          registrationAgency: form.registrationAgency.trim() || undefined,
          countryOfRegistration: form.countryOfRegistration.trim() || undefined,
        },
      });
      toast({ title: t('updateSuccessTitle'), description: t('updateSuccess'), variant: 'success' });
      setIsEditing(false);
    } catch (err) {
      getLogger().error({ err }, 'Failed to update company');
      toast({ title: t('error'), description: t('updateError'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !company) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-text-error">{t('errorLoading')}</p>
        <Button variant="secondary" onClick={() => fetchCompany()} className="mt-4">
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  if (!company || !form) {
    return (
      <div className="text-center py-12">
        <Building2 className="mx-auto h-12 w-12 text-text-placeholders mb-4" />
        <p className="text-text-placeholders">{t('noCompany')}</p>
      </div>
    );
  }

  const readField = (label: string, value?: string | null) => (
    <div className="space-y-1">
      <p className="text-sm font-medium text-text-placeholders">{label}</p>
      <p className="break-words text-sm text-text-body">{value && value.trim() !== '' ? value : '—'}</p>
    </div>
  );

  const showEditAction = isAdmin && !isEditing;

  const editField = (id: string, label: string, key: keyof CompanyFormState) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={form[key]} onChange={(e) => setField(key, e.target.value)} />
    </div>
  );

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={t('title')}
        title={company.name?.trim() || t('title')}
        aside={
          company.onboarding ? (
            <AccountDetailStatus label={t('onboardingStatus')}>
              <Badge
                variant={ONBOARDING_BADGE[company.onboarding.status]}
                size="status"
                className="h-10 min-h-10 px-6 text-sm tracking-[1.5px] shadow-sm"
              >
                {t(`status.${company.onboarding.status}`)}
              </Badge>
            </AccountDetailStatus>
          ) : undefined
        }
      />

      {/* General information */}
      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('generalInfo')}</AccountSectionBar>
        <div className="space-y-5 px-6 py-6 sm:px-8">
          {company.type === 'SUBSIDIARY' && <p className="text-sm text-text-placeholders">{t('subsidiaryNote')}</p>}
          {isEditing ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{editField('company-name', t('companyName'), 'name')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {readField(t('companyName'), company.name)}
              {readField(t('type'), company.type ? t(`types.${company.type}`) : undefined)}
            </div>
          )}
        </div>
      </section>

      {/* Legal information */}
      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('legalInfo')}</AccountSectionBar>
        <div className="px-6 py-6 sm:px-8">
          {isEditing ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editField('company-legalName', t('legalName'), 'legalName')}
              {editField('company-tax', t('taxRegistrationNumber'), 'taxRegistrationNumber')}
              {editField('company-regId', t('registrationId'), 'registrationId')}
              {editField('company-regAgency', t('registrationAgency'), 'registrationAgency')}
              {editField('company-country', t('countryOfRegistration'), 'countryOfRegistration')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {readField(t('legalName'), company.legalInfo?.legalName)}
              {readField(t('taxRegistrationNumber'), company.legalInfo?.taxRegistrationNumber)}
              {readField(t('registrationId'), company.legalInfo?.registrationId)}
              {readField(t('registrationAgency'), company.legalInfo?.registrationAgency)}
              {readField(t('countryOfRegistration'), company.legalInfo?.countryOfRegistration)}
              {readField(t('registrationDate'), company.legalInfo?.registrationDate)}
            </div>
          )}
        </div>
      </section>

      {/* Purchasing limit */}
      <section className="border-b border-border-primary">
        <AccountSectionBar>{t('accountLimit')}</AccountSectionBar>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2 sm:px-8">
          {readField(
            t('limitValue'),
            company.accountLimit?.value != null
              ? `${company.accountLimit.value} ${company.accountLimit.currency ?? ''}`.trim()
              : undefined,
          )}
        </div>
      </section>

      {/* Locations */}
      <section className={isEditing || showEditAction ? 'border-b border-border-primary' : undefined}>
        <AccountSectionBar>{t('addresses')}</AccountSectionBar>
        <div className="px-6 py-6 sm:px-8">
          {company.addresses && company.addresses.length > 0 ? (
            <>
              <div className="mb-4 flex justify-end">
                <Button variant="secondary" size="small" asChild>
                  <Link href="/account/addresses" data-testid="company-manageAddresses">
                    <MapPin className="mr-2 h-4 w-4" />
                    {t('manageAddresses')}
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {company.addresses.map((address, index) => (
                  <div key={address.id ?? index} className="border border-border-primary bg-surface-page p-4">
                    <AddressDisplay address={address} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-text-placeholders">{t('noAddresses')}</p>
              <Button variant="secondary" size="small" asChild>
                <Link href="/account/addresses" data-testid="company-addAddress">
                  <MapPin className="mr-2 h-4 w-4" />
                  {t('addAddress')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {showEditAction && (
        <footer className="px-6 py-6 sm:px-8">
          <AccountSectionLabel className="mb-3">{t('actions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="small" onClick={() => setIsEditing(true)} data-testid="company-edit">
              <Pencil className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          </div>
        </footer>
      )}

      {isEditing && (
        <footer className="flex justify-end gap-2 px-6 py-6 sm:px-8">
          <Button
            variant="secondary"
            onClick={() => {
              setForm(toFormState(company));
              setIsEditing(false);
            }}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="company-save">
            {isSaving ? t('saving') : t('save')}
          </Button>
        </footer>
      )}
    </AccountDetailContainer>
  );
}

export default CompanyDetails;
