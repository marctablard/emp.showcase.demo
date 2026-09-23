'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const legalEntityId = typeof session?.legalEntityId === 'string' ? session.legalEntityId.trim() : '';
  const [applyFailed, setApplyFailed] = useState(false);
  const applyStartedForCustomer = useRef<string | null>(null);

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
    setApplyFailed(false);
    if (customerId) {
      setFetchLoading(true);
      setFetchError(null);
    }
  }

  // Kicked off inline so every state write happens after an await rather than synchronously in
  // the effect body. `ignore` drops the result of a request whose customer is no longer current.
  useEffect(() => {
    applyStartedForCustomer.current = null;
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
    if (!legalEntityId || companies.length === 0) {
      return undefined;
    }
    return companies.find((company) => company.id === legalEntityId);
  }, [companies, legalEntityId]);

  // The name in the header is the session company. When login did not write one,
  // persist the first assigned company (same id the list is built from) before showing it.
  useEffect(() => {
    if (!customerId || loading || sessionLoading || error || legalEntityId || applyFailed) {
      return;
    }
    const targetId = companies[0]?.id;
    if (!targetId || applyStartedForCustomer.current === customerId) {
      return;
    }
    applyStartedForCustomer.current = customerId;

    void (async () => {
      try {
        const success = await setCompany(targetId);
        if (success) {
          router.refresh();
          return;
        }
      } catch {
        // Fall through to the failure toast. The company name stays hidden until the write succeeds.
      }
      applyStartedForCustomer.current = null;
      setApplyFailed(true);
      toast({
        title: t('errorSwitching'),
        description: t('errorSwitchingDescription'),
        variant: 'destructive',
      });
    })();
    // setCompany/toast/t are stable enough; the customer ref guards a second write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFailed, companies, customerId, error, legalEntityId, loading, router, sessionLoading]);

  const switchCompany = async (companyId: string) => {
    try {
      const success = await setCompany(companyId);
      if (success) {
        router.refresh();
      } else {
        toast({
          title: t('errorSwitching'),
          description: t('errorSwitchingDescription'),
          variant: 'destructive',
        });
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

  const awaitingAssignedCompany = companies.length > 0 && !legalEntityId && !applyFailed;

  if (loading || sessionLoading || awaitingAssignedCompany) {
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

  if (!currentCompany && !applyFailed && !legalEntityId) {
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
        current={currentCompany?.id ?? ''}
        label={t('label')}
        unselectedLabel={t('label')}
        onSelected={switchCompany}
        icon={icon}
      />
    </>
  );
}
