import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { OpenMeteoWeatherApi } from '@/platform/integrations/openmeteo/weather/OpenMeteoWeatherApi';
import type { WeatherForecast } from '@/platform/services/model/weather';
import type { WeatherMapper } from '@/platform/services/model/weather/WeatherMapper';
import type { LoggerService } from '../../logger/LoggerService';
import type { WeatherService } from '../WeatherService';

/**
 * OpenMeteo implementation of the WeatherService
 */
@injectable('WeatherService', 'Singleton')
export class OpenMeteoWeatherService implements WeatherService {
  constructor(
    @inject('OpenMeteoWeatherApi') private weatherApi: OpenMeteoWeatherApi,
    @inject('OpenMeteoWeatherMapper') private weatherMapper: WeatherMapper,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  /**
   * Get weather forecast for a specific location
   * @param latitude The latitude coordinate
   * @param longitude The longitude coordinate
   * @returns Promise with weather forecast data
   */
  async getWeatherForecast(latitude: number, longitude: number): Promise<WeatherForecast> {
    try {
      const apiResponse = await this.weatherApi.getWeatherForecast(latitude, longitude);
      return this.weatherMapper.mapToService(apiResponse);
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          latitude,
          longitude,
        },
        'Error fetching weather forecast',
      );
      throw new Error(`Failed to fetch weather forecast: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default OpenMeteoWeatherService;
