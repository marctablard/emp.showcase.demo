import { create } from 'zustand';
import type { Weather, WeatherForecast } from '@/platform/services/model/weather';

interface WeatherStore {
  weather: WeatherForecast | null;
  loading: boolean;
  error: string | null;
  setWeather: (weather: WeatherForecast | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Create a local store to handle layout changes without causing re-renders
export const useWeatherStore = create<WeatherStore>((set) => ({
  weather: null,
  loading: false,
  error: null,
  setWeather: (weather: WeatherForecast | null) => set({ weather }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
}));

/**
 * Parses date strings in a weather object back to Date objects
 * @param weather Weather object with string dates
 * @returns Weather object with proper Date objects
 */
const parseDates = (weather: any): Weather => {
  return {
    ...weather,
    date: new Date(weather.date),
  };
};

/**
 * Parses all date strings in a weather forecast back to Date objects
 * @param forecast Weather forecast with string dates
 * @returns Weather forecast with proper Date objects
 */
const parseWeatherForecastDates = (forecast: any): WeatherForecast => {
  return {
    current: parseDates(forecast.current),
    hourly: forecast.hourly.map(parseDates),
    daily: forecast.daily.map(parseDates),
  };
};

/**
 * Fetches weather data from the API endpoint and parses dates
 * @param latitude The latitude coordinate
 * @param longitude The longitude coordinate
 * @returns Promise with weather forecast data with proper Date objects
 */
export const getWeatherData = async (latitude: number, longitude: number): Promise<WeatherForecast> => {
  // Fetch real weather data from our API endpoint
  const response = await fetch(`/api/weather?latitude=${latitude}&longitude=${longitude}`);

  if (!response.ok) {
    throw new Error(`Weather API responded with status: ${response.status}`);
  }

  // Parse the JSON response
  const rawForecast = await response.json();

  // Convert date strings back to Date objects
  return parseWeatherForecastDates(rawForecast);
};
