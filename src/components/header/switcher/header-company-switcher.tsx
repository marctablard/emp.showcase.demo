'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import TopBarSwitcher from '@/components/ui/molecules/ui-topbar-switcher';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/hooks/session/useSession';
import { useToast } from '@/hooks/ui/useToast';
import type { Company } from '@/platform/services/model/company/company';

// Module-level so the "no customer" case keeps a stable identity across renders.
const NO_COMPANIES: Company[] = [];

export function CompanySwitcher() {
  const { session, loading: sessionLoading, setCompany } = useSession();
  const router = useRouter();
  const t = useTranslations('common.Companies');
  const { toast } = useToast();
  const [fetchedCompanies, setFetchedCompanies] = useState<Company[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Read out of `session` once: optional-chained member expressions in a dependency array
  // cannot be tracked as stable dependencies.
  const customerId = session?.customerId;
  const legalEntityId = session?.legalEntityId;

  // Without a customer there is nothing to show and nothing in flight. Derived during render
  // rather than reset from an effect, so no cascading render is needed to clear stale values.
  const companies = customerId ? fetchedCompanies : NO_COMPANIES;
  const loading = customerId ? fetchLoading : false;
  const error = customerId ? fetchError : null;

  // Enter the loading state during render when the customer changes, so the effect below only
  // has to kick off the request instead of setting state synchronously.
  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  if (prevCustomerId !== customerId) {
    setPrevCustomerId(customerId);
    if (customerId) {
      setFetchLoading(true);
      setFetchError(null);
    }
  }

  // Kicked off inline so every state write happens after an await rather than synchronously in
  // the effect body. `ignore` drops the result of a request whose customer is no longer current.
  useEffect(() => {
    if (!customerId) {
      return;
    }
    let ignore = false;

    void (async () => {
      try {
        const response = await fetch('/api/companies');
        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }
        const data = await response.json();
        if (ignore) {
          return;
        }
        setFetchedCompanies(data);
        setFetchError(null);
      } catch (err) {
        if (ignore) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to load companies';
        setFetchError(errorMessage);
        setFetchedCompanies([]);
        toast({
          title: t('errorLoading'),
          description: t('errorLoadingDescription'),
          variant: 'destructive',
        });
      } finally {
        if (!ignore) {
          setFetchLoading(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/toast are stable and were never tracked here
  }, [customerId]);

  const currentCompany = useMemo(() => {
    if (!companies || companies.length === 0) {
      return undefined;
    }

    if (legalEntityId) {
      const matchedCompany = companies.find((company) => company.id === legalEntityId);
      if (matchedCompany) {
        return matchedCompany;
      }
    }

    return companies[0];
  }, [companies, legalEntityId]);

  const switchCompany = async (companyId: string) => {
    try {
      const success = await setCompany(companyId);
      if (success) {
        router.refresh();
      } else {
        setFetchError('Failed to switch company');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch company';
      setFetchError(errorMessage);
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
