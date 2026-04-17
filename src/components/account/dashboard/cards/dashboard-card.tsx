import type { ReactNode } from 'react';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  variant?: 'default' | 'stat' | 'primary';
}

export function DashboardCard({
  title,
  subtitle,
  icon,
  className = '',
  children,
  variant = 'stat',
}: DashboardCardProps) {
  return (
    <Card variant={variant} className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="text-sm font-medium text-text-on-action mt-1">{subtitle}</p>}
          {icon && <div className="h-4 w-4 text-icon-secondary absolute top-4 right-4">{icon}</div>}
        </CardHeader>
      )}
      <CardContent className="overflow-y-auto p-4 pt-0 pb-0 scrollbar-thin">{children}</CardContent>
    </Card>
  );
}
