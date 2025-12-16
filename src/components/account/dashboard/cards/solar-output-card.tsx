'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Sun } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from '@/hooks/location/useLocation';
import useWeather from '@/hooks/weather/useWeather';
import { DashboardCard, DashboardCardProps } from './dashboard-card';

/**
 * Solar Output Card component
 * Shows the estimated solar panel output based on weather conditions
 */
export function SolarOutputCard({ className, title, ...props }: Omit<DashboardCardProps, 'children'>) {
  const t = useTranslations('account');
  const tWeather = useTranslations('account.Weather');
  const { weather, loading, error } = useWeather();
  const { location } = useLocation();

  // Calculate solar output based on weather conditions and time of day
  const solarOutputData = useMemo(() => {
    if (!weather || !weather.hourly) {
      return [];
    }

    // Create hourly data for the next 24 hours based on current weather
    // Since we don't have actual hourly forecast, we'll simulate it
    const hourlyData = [];
    const currentDate = new Date();

    for (let i = 0; i < 24; i++) {
      const hourDate = new Date(currentDate);
      hourDate.setHours(currentDate.getHours() + i);

      // Slightly vary the weather conditions for simulation
      const weatherDescription = weather.hourly[i].description;

      hourlyData.push({
        time: hourDate.toISOString(),
        description: weatherDescription,
        temperature: weather.hourly[i].temperature, // Add some variation
      });
    }

    return hourlyData.map((hour) => {
      const date = new Date(hour.time);
      const hourOfDay = date.getHours();

      // Base efficiency factors
      let weatherFactor = 0.8; // Default for sunny
      if (hour.description.toLowerCase().includes('cloud')) {
        weatherFactor = 0.5; // Cloudy
      } else if (
        hour.description.toLowerCase().includes('rain') ||
        hour.description.toLowerCase().includes('snow') ||
        hour.description.toLowerCase().includes('thunder')
      ) {
        weatherFactor = 0.2; // Rainy/snowy conditions
      }

      // Day/night factor (simplified solar curve)
      let dayFactor = 0;
      if (hourOfDay >= 6 && hourOfDay <= 18) {
        // Create a bell curve peaking at noon
        // 0 at 6am/6pm, 1 at noon
        dayFactor = 1 - Math.abs(12 - hourOfDay) / 6;
      }

      // Calculate output as percentage of maximum capacity (1.4 kWp)
      const outputPercentage = weatherFactor * dayFactor;
      const outputKw = outputPercentage * 1.4;

      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        output: parseFloat(outputKw.toFixed(2)),
        weather: tWeather(hour.description),
        temperature: hour.temperature.toFixed(1),
      };
    });
  }, [weather, tWeather]);

  // Format address for display
  const addressDisplay = useMemo(() => {
    if (!location || !location.city) return 'your location';
    return location.city;
  }, [location]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-[240px]" />
          </CardTitle>
          <CardContent>
            <Skeleton className="h-4 w-[200px]" />
          </CardContent>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <DashboardCard
        title={title || t('solarOutput', { defaultValue: 'Solar Output' })}
        subtitle={t('solarOutputError', { defaultValue: 'Unable to load solar output data' })}
        className={className}
        {...props}
      >
        <div className="flex items-center justify-center h-[200px] text-text-placeholders">
          {t('weatherDataUnavailable', { defaultValue: 'Weather data unavailable' })}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title={title || `${t('estimatedOutput', { defaultValue: 'Estimated Output' })} (${addressDisplay})`}
      subtitle={t('installationSize', { size: '1.4 kWp' })}
      icon={<Sun className="h-4 w-4" />}
      className={`${className}`}
      {...props}
    >
      <ChartContainer
        className="h-[200px] w-full"
        config={{
          solarOutput: {
            label: 'Solar Output',
            color: '#f59e0b',
          },
        }}
      >
        <AreaChart data={solarOutputData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-surface-disabled" />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => value}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => `${value}`}
            domain={[0, 'auto']}
            width={30}
            label={{ value: 'kW', position: 'insideLeft', angle: -90, dy: 10, fontSize: 10, fill: '#888' }}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-md border bg-surface-page p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm uppercase text-text-placeholders">Time</span>
                        <span className="font-bold text-text-body">{payload[0].payload.time}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm uppercase text-text-placeholders">Output</span>
                        <span className="font-bold text-text-body">{payload[0].value} kW</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm uppercase text-text-placeholders">Weather</span>
                        <span className="font-bold text-text-body">{payload[0].payload.weather}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm uppercase text-text-placeholders">Temperature</span>
                        <span className="font-bold text-text-body">{payload[0].payload.temperature}°C</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="output"
            stroke="#f59e0b"
            fillOpacity={1}
            fill="url(#solarGradient)"
            name="solarOutput"
          />
        </AreaChart>
      </ChartContainer>
    </DashboardCard>
  );
}
