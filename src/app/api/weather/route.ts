import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { WeatherForecast } from '@/platform/services/model/weather';
import { WeatherService } from '@/platform/services/weather/WeatherService';

/**
 * GET handler for weather forecast API endpoint
 * @param request The incoming request with latitude and longitude as query parameters
 * @returns NextResponse with weather forecast data
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get latitude and longitude from query parameters
    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloat(searchParams.get('latitude') || '');
    const longitude = parseFloat(searchParams.get('longitude') || '');

    // Validate parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid parameters. Both latitude and longitude are required.' },
        { status: 400 },
      );
    }

    // Get weather service from platform
    const weatherService = server.get<WeatherService>('WeatherService');

    // Get weather forecast
    const forecast: WeatherForecast = await weatherService.getWeatherForecast(latitude, longitude);

    // Return forecast as JSON response with ISO string dates
    // The dates will be automatically converted to ISO strings during JSON serialization
    return NextResponse.json(forecast);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
