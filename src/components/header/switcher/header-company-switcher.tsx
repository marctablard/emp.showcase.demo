'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/hooks/session/useSession';
import { useToast } from '@/hooks/ui/useToast';
import { Company } from '@/platform/services/model/company/company';

export function CompanySwitcher() {
  const { session, loading: sessionLoading, setCompany } = useSession();
  const router = useRouter();
  const t = useTranslations('common.Companies');
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/companies');
      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }
      const data = await response.json();
      setCompanies(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load companies';
      setError(errorMessage);
      setCompanies([]);
      toast({
        title: t('errorLoading'),
        description: t('errorLoadingDescription'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session?.customerId) {
      fetchCompanies();
    } else {
      setCompanies([]);
      setLoading(false);
      setError(null);
    }
  }, [session?.customerId, fetchCompanies]);

  const currentCompany = useMemo(() => {
    if (!companies || companies.length === 0) {
      return undefined;
    }

    if (session?.legalEntityId) {
      const matchedCompany = companies.find((company) => company.id === session.legalEntityId);
      if (matchedCompany) {
        return matchedCompany;
      }
    }

    return companies[0];
  }, [companies, session?.legalEntityId]);

  const switchCompany = async (companyId: string) => {
    try {
      const success = await setCompany(companyId);
      if (success) {
        router.refresh();
      } else {
        setError('Failed to switch company');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch company';
      setError(errorMessage);
      toast({
        title: t('errorSwitching'),
        description: t('errorSwitchingDescription'),
        variant: 'destructive',
      });
    }
  };

  if (loading || sessionLoading) {
    return (
      <>
        <hr className="w-px h-6 bg-surface-page" />
        <Spinner color="default" variant="sm" />
      </>
    );
  }

  if (error) {
    return null;
  }

  if (!companies || companies.length === 0) {
    return null;
  }

  if (!currentCompany) {
    return null;
  }

  const options = companies.map((company) => ({
    code: company.id,
    name: company.name,
  }));

  const icon = (
    <span className="w-4 h-4">
      <Building2 className="w-4 h-4" />
    </span>
  );

  return (
    <>
      <hr className="w-px h-6 bg-surface-page" />
      <TopBarSwitcher
        options={options}
        current={currentCompany.id}
        label={t('label')}
        onSelected={switchCompany}
        icon={icon}
      />
    </>
  );
}
