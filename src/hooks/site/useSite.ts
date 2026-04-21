'use client';

import { useCallback, useContext, useEffect, useState } from 'react';
import { getSite as apiGetSite, getSites as apiGetSites } from '@/lib/client/site';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Country, Currency, Region } from '@/platform/services/model/common';
import type { PaymentMode } from '@/platform/services/model/payment';
import { SiteContext } from '@/providers/SiteProvider';
import { useSiteStore } from '@/providers/StoreProvider';

/**
 * Hook for accessing site data like countries, regions, and currencies
 */
export function useSite(id?: string) {
  const {
    setLoading,
    getLoading,
    setSite,
    getSite,
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
  const [countries, setCountries] = useState<Country[] | undefined>(getSite()?.countries);
  const [regions, setRegions] = useState<Region[] | undefined>(getSite()?.regions);
  const [currencies, setCurrencies] = useState<Currency[] | undefined>(getSite()?.currencies);
  const [paymentModes, setPaymentModes] = useState<PaymentMode[] | undefined>(getSite()?.paymentModes);
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
    if (site) {
      setCountries(site.countries);
      setRegions(site.regions);
      setCurrencies(site.currencies);
      setPaymentModes(site.paymentModes);
    } else if (site === null) {
      setCountries([]);
      setRegions([]);
      setCurrencies([]);
      setPaymentModes([]);
    } else if (site === undefined && !getLoading()) {
      fetchSiteData();
    }
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
