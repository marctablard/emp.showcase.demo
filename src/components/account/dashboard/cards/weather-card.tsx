'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Cloudy, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWeather } from '@/hooks/weather/useWeather';
import { type WeatherKey, dk } from '@/i18n/dynamic-key';
import type { LocationData } from '@/platform/services/model/common';
import type { DashboardCardProps } from './dashboard-card';
import { DashboardCard } from './dashboard-card';

interface WeatherCardProps extends Omit<DashboardCardProps, 'children'> {}

interface WeatherIconProps {
  description: string;
  className?: string;
}

/**
 * Component that renders the appropriate weather icon based on the weather description
 */
const WeatherIcon: React.FC<WeatherIconProps> = ({ description, className = 'h-10 w-10' }) => {
  // Group similar weather conditions
  switch (description) {
    // Clear conditions
    case 'clearSky':
    case 'mainlyClear':
      return <Sun className={className} />;

    // Cloudy conditions
    case 'partlyCloudy':
      return <CloudSun className={className} />;
    case 'overcast':
      return <Cloudy className={className} />;

    // Fog conditions
    case 'fog':
    case 'depositingRimeFog':
      return <CloudFog className={className} />;

    // Drizzle conditions
    case 'lightDrizzle':
    case 'moderateDrizzle':
    case 'denseDrizzle':
    case 'lightFreezingDrizzle':
    case 'denseFreezingDrizzle':
      return <CloudDrizzle className={className} />;

    // Rain conditions
    case 'slightRain':
    case 'moderateRain':
    case 'heavyRain':
    case 'lightFreezingRain':
    case 'heavyFreezingRain':
    case 'slightRainShowers':
    case 'moderateRainShowers':
    case 'violentRainShowers':
      return <CloudRain className={className} />;

    // Snow conditions
    case 'slightSnowFall':
    case 'moderateSnowFall':
    case 'heavySnowFall':
    case 'snowGrains':
    case 'slightSnowShowers':
    case 'heavySnowShowers':
      return <CloudSnow className={className} />;

    // Thunderstorm conditions
    case 'thunderstorm':
    case 'thunderstormWithSlightHail':
    case 'thunderstormWithHeavyHail':
      return <CloudLightning className={className} />;

    // Default/unknown
    default:
      return <Sun className={className} />;
  }
};

export function WeatherCard({ className, title, subtitle, ...props }: WeatherCardProps) {
  const t = useTranslations('account.Weather');
  // TODO this breaks rendering and causes infinite loops
  //const state = useLocalDashboardStore();
  //const grid = state.renderedLayout ? findCardLayout('weather', state.renderedLayout) : { cols: 1, rows: 1 };
  const { weather, loading, changeLocation } = useWeather();

  if (loading || !weather) {
    return (
      <DashboardCard className={className} variant="primary" {...props}>
        <div className="flex justify-center items-center h-32">{t('loading')}</div>
      </DashboardCard>
    );
  }
  return (
    <DashboardCard
      title={title || t(dk<WeatherKey>(weather.current.description))}
      subtitle={
        subtitle ||
        weather.current.date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }
      className={className}
      variant="primary"
      {...props}
    >
      <>
        <div className={`flex-wrap gap-4 w-full`}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <WeatherIcon description={weather.current.description} />
            </div>
            <div>
              <div className="text-3xl font-bold flex items-start">{weather.current.temperature.toFixed(1)}°</div>
              <div className="text-sm">{weather.current.location}</div>
            </div>
          </div>
          <div
            className={`text-sm ${'border-l border-border-primary pl-4 flex-shrink-0 flex flex-col justify-center'}`}
          >
            <div className="flex justify-between py-1">
              <span>{t('precipitation')}:</span>
              <span>{weather.current.precipitation}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span>{t('humidity')}:</span>
              <span>{weather.current.humidity}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span>{t('wind')}:</span>
              <span>{weather.current.windSpeed.toFixed(1)} km/h</span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="link"
            className="text-text-on-action hover:text-text-on-action hover:bg-surface-action-hover w-full"
            onClick={() => {
              const berlinLocation: LocationData = {
                city: 'Berlin',
                country: { code: 'DE', name: 'Germany' },
                state: 'Berlin',
                geoLocation: { latitude: 52.52, longitude: 13.405 },
              };
              changeLocation(berlinLocation);
            }}
          >
            {t('changeLocation')}
          </Button>
        </div>
      </>
    </DashboardCard>
  );
}

export default WeatherCard;
