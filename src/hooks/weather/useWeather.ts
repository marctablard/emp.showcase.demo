'use client';

import { useEffect, useState } from 'react';
import { getWeatherData, useWeatherStore } from '@/lib/client/weather';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { LocationData } from '@/platform/services/model/common';
import { useLocation } from '../location/useLocation';

export function useWeather() {
  const { weather, loading, error, setWeather, setLoading, setError } = useWeatherStore();
  const { location: userLocation, loading: locationLoading, error: locationError } = useLocation();
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  const DEFAULT_LOCATION: LocationData = {
    city: 'Berlin',
    country: {
      code: 'DE',
      name: 'Germany',
    },
    geoLocation: {
      latitude: 52.52,
      longitude: 13.405,
    },
    state: 'Berlin',
  };

  const isLocationAvailable = !locationLoading && !locationError;
  const resolvedLocation = selectedLocation ?? userLocation ?? (isLocationAvailable ? DEFAULT_LOCATION : null);

  useEffect(() => {
    let isCancelled = false;

    const geoLocation = resolvedLocation?.geoLocation;

    // Only fetch weather when we have location data
    if (!geoLocation) {
      return;
    }

    if (weather) {
      if (loading) {
        setLoading(false);
      }
      return;
    }

    if (loading) {
      return;
    }

    // Fetch real weather data using server action
    const fetchWeatherData = async () => {
      if (isCancelled) {
        return;
      }

      setLoading(true);

      try {
        const forecast = await getWeatherData(geoLocation.latitude, geoLocation.longitude);
        setWeather(forecast);
      } catch (err) {
        getLogger().error({ err }, 'Error fetching weather data');
        setError('Failed to fetch weather data');
      } finally {
        setLoading(false);
      }
    };

    void fetchWeatherData();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeLocation = async (location: LocationData): Promise<void> => {
    setWeather(null);
    setSelectedLocation(location);
  };

  return {
    weather,
    loading,
    error,
    changeLocation,
  };
}

export default useWeather;
