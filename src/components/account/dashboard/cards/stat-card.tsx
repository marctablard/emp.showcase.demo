'use client';

import React from 'react';
import { H6 } from '@/components/ui/h';
import { DashboardCard, DashboardCardProps } from './dashboard-card';

export interface StatCardProps extends Omit<DashboardCardProps, 'children'> {
  value: string | number;
  description?: string;
}

export function StatCard({ value, description, className, ...props }: StatCardProps) {
  return (
    <DashboardCard variant="stat" className={`${className} h-full`} {...props}>
      <H6>{value}</H6>
      {description && <p className="text-sm text-text-placeholders">{description}</p>}
    </DashboardCard>
  );
}

export default StatCard;
