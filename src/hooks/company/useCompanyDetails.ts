'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession as useAuthSession } from 'next-auth/react';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { useSession } from '@/hooks/session/useSession';
import { fetchCompanyDetails, updateCompanyDetails } from '@/lib/client/company';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { CompanyDetails, CompanyUpdateDto } from '@/platform/services/model/company/company';

interface CompanyDetailsHook {
  company: CompanyDetails | null;
  loading: boolean;
  error: Error | null;
  fetchCompany: () => Promise<void>;
  updateCompany: (update: CompanyUpdateDto) => Promise<CompanyDetails>;
}

/**
 * Hook providing the currently selected company's details. Re-fetches whenever
 * the selected legal entity changes (company switcher).
 */
export function useCompanyDetails(): CompanyDetailsHook {
  const { status } = useAuthSession();
  const { session } = useSession();
  const legalEntityId = session?.legalEntityId;

  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCompanyDetails();
      setCompany(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch company'));
      getLogger().error({ err }, 'Error fetching company details');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCompany = useCallback(async (update: CompanyUpdateDto): Promise<CompanyDetails> => {
    try {
      setLoading(true);
      setError(null);
      const updated = await updateCompanyDetails(update);
      setCompany(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update company');
      setError(error);
      getLogger().error({ err }, 'Error updating company details');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    // Re-fetch when the selected company changes.
    return startEffectTask(fetchCompany);
  }, [status, legalEntityId, fetchCompany]);

  return { company, loading, error, fetchCompany, updateCompany };
}

export default useCompanyDetails;
