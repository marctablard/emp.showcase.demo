'use client';

import * as React from 'react';
import { H4 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface SummaryCardProps extends React.ComponentProps<typeof Card> {
  heading: React.ReactNode;
  hasHeadline?: boolean;
  icon?: React.ReactNode;
  headerClassName?: string;
  contentClassName?: string;
}

export function SummaryCard({
  heading,
  icon,
  className,
  headerClassName,
  contentClassName,
  children,
  hasHeadline,
  ...props
}: SummaryCardProps) {
  return (
    <Card className={cn('border-none shadow-sm', className)} {...props}>
      <CardHeader className={cn('pb-2', headerClassName)}>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{hasHeadline ? <H4>{heading}</H4> : <span className="text-lg">{heading}</span>}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-2', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface SummaryRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  valueClassName?: string;
  /** Emphasize the value (e.g., for totals) */
  strong?: boolean;
  /** Render the label as muted text */
  mutedLabel?: boolean;
}

export function SummaryRow({
  label,
  children,
  className,
  valueClassName,
  strong,
  mutedLabel,
  ...props
}: SummaryRowProps) {
  return (
    <div className={cn('flex justify-between text-sm', strong && 'font-bold', className)} {...props}>
      <span className={cn(mutedLabel ? 'text-text-on-disabled' : undefined)}>{label}</span>
      <span className={cn(valueClassName)}>{children}</span>
    </div>
  );
}

interface SummaryFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

/**
 * Stacked label/value field: renders the label above the value instead of side-by-side.
 * Prefer this over `SummaryRow` when the value may be long relative to the available
 * width (e.g. narrow cards), since `SummaryRow`'s side-by-side layout can cause the
 * label and value to wrap independently into an ambiguous fragment.
 *
 * Label defaults to bold Ubuntu h5 (20/24); value defaults to regular Open Sans body-md
 * (16/24). Fields are vertically stacked with a compact gap.
 */
export function SummaryField({
  label,
  children,
  className,
  labelClassName,
  valueClassName,
  ...props
}: SummaryFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <div className={cn('text-3xl font-bold font-headlines text-text-headings', labelClassName)}>{label}</div>
      <div className={cn('text-base font-normal font-body text-text-body', valueClassName)}>{children}</div>
    </div>
  );
}
