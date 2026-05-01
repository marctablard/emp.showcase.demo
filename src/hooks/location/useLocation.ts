'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { LocationData } from '@/platform/services/model/common';
import { useAddresses } from '../customer/useAddresses';
import { useSite } from '../site/useSite';

export interface UseLocationResult {
  location: LocationData | null | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get the user's location using browser geolocation API or fallback to GeoIP
 */
export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LocationData | null | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { addresses } = useAddresses();
  const { countries } = useSite();

  // Try to get location from the first shipping-tagged customer address, if any
  const getLocationFromCustomerAddress = useCallback((): LocationData | null => {
    const shippingAddress = (addresses || []).find((addr) => addr.tags.includes('SHIPPING'));

    if (!shippingAddress) {
      return null;
    }
    const country = countries?.find((country) => country.code === shippingAddress.country) || null;
    if (shippingAddress.city && country) {
      return {
        city: shippingAddress.city,
        country: country,
        geoLocation: shippingAddress.geoLocation,
        state: shippingAddress.state || '',
        postalCode: shippingAddress.zipCode,
        // TODO derive timezone from geolocation/country; hardcoded until a real mapping is in place.
        timezone: 'Europe/Berlin',
      };
    }

    return null;
  }, [addresses, countries]);

  const fetchLocationFromBrowser = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Get coordinates from browser
            const { latitude, longitude } = position.coords;

            // In a real implementation, we would do a reverse geocoding API call
            // to get city, country, etc. based on coordinates
            // For now, we'll return just the coordinates with default values for other fields

            resolve({
              city: '',
              country: {
                code: 'DE',
                name: 'Germany',
              },
              geoLocation: {
                latitude,
                longitude,
              },
              state: '',
              postalCode: '',
              timezone: 'Europe/Berlin',
            });
          } catch (_err) {
            reject(new Error('Failed to process browser geolocation'));
          }
        },
        (err) => {
          reject(new Error(`Geolocation permission denied: ${err.message}`));
        },
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 0 },
      );
    });
  }, []);

  /**
   * Maps GeoIP API response to LocationData format
   */
  const mapGeoIPToLocationData = (geoIPData: any): LocationData => {
    return {
      city: geoIPData.city || '',
      country: {
        code: geoIPData.countryCode || '',
        name: geoIPData.country || '',
      },
      geoLocation: {
        latitude: geoIPData.latitude || 0,
        longitude: geoIPData.longitude || 0,
      },
      state: geoIPData.region || '',
      postalCode: geoIPData.postalCode || '',
      timezone: geoIPData.timezone || 'Europe/Berlin',
    };
  };

  const fetchLocationFromGeoIP = useCallback(async (): Promise<LocationData> => {
    try {
      const response = await fetch('/api/location');

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return mapGeoIPToLocationData(data);
    } catch (err) {
      getLogger().error({ err }, 'Error fetching from GeoIP API');
      throw new Error('Failed to fetch location from GeoIP');
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Try to get location from customer's shipping address first
    const locationData = getLocationFromCustomerAddress();
    if (locationData) {
      setLocation(locationData);
      setLoading(false);
      return;
    }
    // If customer address fails, try browser geolocation
    try {
      const locationData = await fetchLocationFromBrowser();
      setLocation(locationData);
    } catch (browserErr) {
      getLogger().debug({ err: browserErr }, 'Browser geolocation failed, falling back to GeoIP');

      // If browser geolocation fails, fall back to GeoIP
      try {
        const locationData = await fetchLocationFromGeoIP();
        setLocation(locationData);
      } catch (geoIPErr) {
        getLogger().error({ err: geoIPErr }, 'GeoIP fallback also failed');
        setError('Failed to determine your location. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchLocationFromBrowser, fetchLocationFromGeoIP, getLocationFromCustomerAddress]);

  useEffect(() => {
    if (location === undefined && !loading && addresses !== undefined && countries !== undefined) {
      fetchLocation();
    }
  }, [loading, location, addresses, countries, fetchLocation]);

  const refetch = async (): Promise<void> => {
    await fetchLocation();
  };

  return { location, loading, error, refetch };
}

export default useLocation;
