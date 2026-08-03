'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { getSite as apiGetSite, getSites as apiGetSites } from '@/lib/client/site';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Country, Currency, Region } from '@/platform/services/model/common';
import type { PaymentMode } from '@/platform/services/model/payment';
import { SiteContext } from '@/providers/SiteProvider';
import { useSiteStore } from '@/providers/StoreProvider';

// Module-level so the "resolved, but no site" case keeps a stable identity across renders.
const NO_COUNTRIES: Country[] = [];
const NO_REGIONS: Region[] = [];
const NO_CURRENCIES: Currency[] = [];
const NO_PAYMENT_MODES: PaymentMode[] = [];

/**
 * Hook for accessing site data like countries, regions, and currencies
 */
export function useSite(id?: string) {
  const {
    setLoading,
    getLoading,
    setSite,
    setAvailableSites,
    getAvailableSites,
    availableSites,
    resetSite,
    loading,
    site,
  } = useSiteStore();
  const urlSiteCode = useContext(SiteContext);
  const effectiveSiteCode = id || urlSiteCode;

  useEffect(() => {
    if (effectiveSiteCode && site && site.code !== effectiveSiteCode) {
      resetSite();
    }
  }, [effectiveSiteCode, site, resetSite]);
  // Derived from the store's site instead of mirrored into local state by an effect.
  // `null` means "resolved, but there is no site", which surfaces as empty lists;
  // `undefined` means "not resolved yet" and stays undefined until the fetch below completes.
  const countries: Country[] | undefined = site === null ? NO_COUNTRIES : site?.countries;
  const regions: Region[] | undefined = site === null ? NO_REGIONS : site?.regions;
  const currencies: Currency[] | undefined = site === null ? NO_CURRENCIES : site?.currencies;
  const paymentModes: PaymentMode[] | undefined = site === null ? NO_PAYMENT_MODES : site?.paymentModes;
  const [error, setError] = useState<Error | null>(null);

  const fetchSiteData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const siteCode = id || urlSiteCode;
      const cachedAvailableSites = getAvailableSites();
      const hasCachedAvailable = Array.isArray(cachedAvailableSites) && cachedAvailableSites.length > 0;

      if (siteCode) {
        if (hasCachedAvailable) {
          const currentSite = await apiGetSite(siteCode);
          setSite(currentSite);
        } else {
          const [currentSite, allSites] = await Promise.all([apiGetSite(siteCode), apiGetSites()]);
          setSite(currentSite);
          setAvailableSites(allSites.available);
        }
      } else {
        const data = await apiGetSites();
        setSite(data.current);
        if (!hasCachedAvailable) {
          setAvailableSites(data.available);
        }
      }
    } catch (error) {
      getLogger().error({ err: error }, 'Error fetching site data');
      setError(error instanceof Error ? error : new Error('Failed to fetch site data'));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSite, setAvailableSites, getAvailableSites, id, urlSiteCode]);

  useEffect(() => {
    if (site !== undefined || getLoading()) {
      return;
    }
    return startEffectTask(fetchSiteData);
  }, [getLoading, fetchSiteData, site]);

  return {
    site,
    countries,
    regions,
    currencies,
    paymentModes,
    availableSites,
    loading,
    error,
    fetchSiteData,
  };
}
