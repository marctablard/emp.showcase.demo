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
  const { setLoading, getLoading, setSite, getSite, setAvailableSites, availableSites, reset, loading, site } =
    useSiteStore();
  const urlSiteCode = useContext(SiteContext);
  if (id && site && site.code != id) {
    // id mismatch, that's a client-side site-switch
    reset();
  }
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
      if (siteCode) {
        // Fetch specific site by code (URL-derived) to avoid returning the Emporix default
        const [currentSite, allSites] = await Promise.all([apiGetSite(siteCode), apiGetSites()]);
        setSite(currentSite);
        setAvailableSites(allSites.available);
      } else {
        const data = await apiGetSites();
        setSite(data.current);
        setAvailableSites(data.available);
      }
    } catch (error) {
      getLogger().error({ err: error }, 'Error fetching site data');
      setError(error instanceof Error ? error : new Error('Failed to fetch site data'));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSite, setAvailableSites, id, urlSiteCode]);

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
