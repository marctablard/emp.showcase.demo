import { injectable } from '@/platform/core/di/injectable';
import type { OpenMeteoWeatherData, OpenMeteoWeatherForecast } from '@/platform/integrations/openmeteo/model/weather';
import type { WeatherMapper } from '../WeatherMapper';
import type { Weather, WeatherForecast } from '../index';

/**
 * Maps between OpenMeteo Weather model and Service Weather model
 */
@injectable('OpenMeteoWeatherMapper', 'Singleton')
export class OpenMeteoWeatherMapper implements WeatherMapper {
  /**
   * Maps an OpenMeteo WeatherForecast to a Service WeatherForecast
   * @param openMeteoForecast The OpenMeteo WeatherForecast to map
   * @returns A Service WeatherForecast
   */
  mapToService(openMeteoForecast: OpenMeteoWeatherForecast): WeatherForecast {
    return {
      current: this.mapWeatherDataToService(openMeteoForecast.current),
      hourly: openMeteoForecast.hourly.map((hourData) => this.mapWeatherDataToService(hourData)),
      daily: openMeteoForecast.daily.map((dailyData) => this.mapWeatherDataToService(dailyData)),
    };
  }

  /**
   * Maps an OpenMeteo WeatherData to a Service Weather
   * @param openMeteoWeatherData The OpenMeteo WeatherData to map
   * @returns A Service Weather
   */
  mapWeatherDataToService(openMeteoWeatherData: OpenMeteoWeatherData): Weather {
    return {
      temperature: openMeteoWeatherData.temperature,
      precipitation: openMeteoWeatherData.precipitation,
      humidity: openMeteoWeatherData.humidity,
      windSpeed: openMeteoWeatherData.windSpeed,
      date: openMeteoWeatherData.date,
      description: this.getWeatherDescriptionKey(openMeteoWeatherData.descriptionCode),
      location: openMeteoWeatherData.location,
    };
  }

  /**
   * Get a weather description key from a WMO weather code
   * @param code The WMO weather code
   * @returns A string key for localization
   */
  getWeatherDescriptionKey(code: number): string {
    // WMO Weather interpretation codes (WW)
    // https://open-meteo.com/en/docs
    switch (code) {
      case 0:
        return 'clearSky';
      case 1:
        return 'mainlyClear';
      case 2:
        return 'partlyCloudy';
      case 3:
        return 'overcast';
      case 45:
        return 'fog';
      case 48:
        return 'depositingRimeFog';
      case 51:
        return 'lightDrizzle';
      case 53:
        return 'moderateDrizzle';
      case 55:
        return 'denseDrizzle';
      case 56:
        return 'lightFreezingDrizzle';
      case 57:
        return 'denseFreezingDrizzle';
      case 61:
        return 'slightRain';
      case 63:
        return 'moderateRain';
      case 65:
        return 'heavyRain';
      case 66:
        return 'lightFreezingRain';
      case 67:
        return 'heavyFreezingRain';
      case 71:
        return 'slightSnowFall';
      case 73:
        return 'moderateSnowFall';
      case 75:
        return 'heavySnowFall';
      case 77:
        return 'snowGrains';
      case 80:
        return 'slightRainShowers';
      case 81:
        return 'moderateRainShowers';
      case 82:
        return 'violentRainShowers';
      case 85:
        return 'slightSnowShowers';
      case 86:
        return 'heavySnowShowers';
      case 95:
        return 'thunderstorm';
      case 96:
        return 'thunderstormWithSlightHail';
      case 99:
        return 'thunderstormWithHeavyHail';
      default:
        return 'unknown';
    }
  }

  /**
   * Maps a Service WeatherForecast to an OpenMeteo WeatherForecast
   * Not implemented as we don't need to convert back to the API format
   */
  mapToSource(_forecast: WeatherForecast): OpenMeteoWeatherForecast {
    throw new Error('Not implemented');
  }
}

export default OpenMeteoWeatherMapper;
