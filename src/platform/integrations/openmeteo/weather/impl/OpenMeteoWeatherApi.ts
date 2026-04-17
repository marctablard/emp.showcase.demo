import { inject } from 'inversify';
import { fetchWeatherApi } from 'openmeteo';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { OpenMeteoWeatherData, OpenMeteoWeatherForecast } from '../../model/weather';
import type { OpenMeteoWeatherApi as IOpenMeteoWeatherApi } from '../OpenMeteoWeatherApi';

/**
 * Implementation of the WeatherApi interface using the Open-Meteo API
 * @see https://open-meteo.com/
 */
@injectable('OpenMeteoWeatherApi', 'Singleton')
class OpenMeteoWeatherApi implements IOpenMeteoWeatherApi {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';

  constructor(@inject('LoggerService') private logger: LoggerService) {}

  /**
   * Get weather forecast for a specific location
   * @param latitude The latitude coordinate
   * @param longitude The longitude coordinate
   * @returns Promise with weather forecast data
   */
  async getWeatherForecast(latitude: number, longitude: number): Promise<OpenMeteoWeatherForecast> {
    // Validate coordinates are within valid ranges
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`Latitude must be in range of -90 to 90°. Given: ${latitude}.`);
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`Longitude must be in range of -180 to 180°. Given: ${longitude}.`);
    }
    try {
      const params = {
        latitude,
        longitude,
        current: ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'wind_speed_10m', 'weather_code'],
        hourly: ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'wind_speed_10m', 'weather_code'],
        daily: ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'wind_speed_10m_max', 'weather_code'],
        timezone: 'auto',
      };

      const responses = await fetchWeatherApi(this.baseUrl, params);
      const response = responses[0];

      // Process timezone and location data
      const utcOffsetSeconds = response.utcOffsetSeconds();
      /*
      const timezone = response.timezone();
      const timezoneAbbreviation = response.timezoneAbbreviation();
      */
      // Process current weather
      const current = response.current()!;
      const currentWeatherData: OpenMeteoWeatherData = {
        temperature: current.variables(0)!.value(),
        humidity: current.variables(1)!.value(),
        precipitation: current.variables(2)!.value(),
        windSpeed: current.variables(3)!.value(),
        descriptionCode: current.variables(4)!.value(),
        date: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
        location: `${response.latitude().toFixed(2)}, ${response.longitude().toFixed(2)}`,
      };

      // Process hourly forecast
      const hourly = response.hourly()!;
      const hourlyData: OpenMeteoWeatherData[] = [];

      for (let i = 0; i < 24; i++) {
        // Get 24 hours of forecast
        hourlyData.push({
          temperature: hourly.variables(0)!.valuesArray()![i],
          humidity: hourly.variables(1)!.valuesArray()![i],
          precipitation: hourly.variables(2)!.valuesArray()![i],
          windSpeed: hourly.variables(3)!.valuesArray()![i],
          descriptionCode: hourly.variables(4)!.valuesArray()![i],
          date: new Date((Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000),
          location: `${response.latitude().toFixed(2)}, ${response.longitude().toFixed(2)}`,
        });
      }

      // Process daily forecast
      const daily = response.daily()!;
      const dailyData: OpenMeteoWeatherData[] = [];

      for (let i = 0; i < 7; i++) {
        dailyData.push({
          temperature: (daily.variables(0)!.valuesArray()![i] + daily.variables(1)!.valuesArray()![i]) / 2, // Average of max and min
          humidity: 0, // Not available in daily forecast
          precipitation: daily.variables(2)!.valuesArray()![i],
          windSpeed: daily.variables(3)!.valuesArray()![i],
          descriptionCode: daily.variables(4)!.valuesArray()![i],
          date: new Date((Number(daily.time()) + i * 86400 + utcOffsetSeconds) * 1000), // 86400 seconds in a day
          location: `${response.latitude().toFixed(2)}, ${response.longitude().toFixed(2)}`,
        });
      }

      return {
        current: currentWeatherData,
        hourly: hourlyData,
        daily: dailyData,
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Error fetching weather data',
      );
      throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default OpenMeteoWeatherApi;
