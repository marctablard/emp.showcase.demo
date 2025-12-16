import React from 'react';
import { VariantProps, cva } from 'class-variance-authority';
import { LucideIcon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const bulletPointVariants = cva('flex items-center gap-2', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    },
    variant: {
      default: 'text-text-body',
      primary: 'text-text-action',
      white: 'text-text-on-action',
    },
    iconColor: {
      default: 'text-text-body',
      primary: 'text-text-action',
      white: 'text-text-on-action',
    },
    iconSize: {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
});

interface BulletPointProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof bulletPointVariants> {
  icon?: LucideIcon;
  label: string;
  value?: React.ReactNode;
  valueClassName?: string;
}

export function BulletPoint({
  icon: Icon = Sun,
  label,
  value,
  size,
  variant,
  iconColor,
  iconSize,
  className,
  valueClassName,
  ...props
}: BulletPointProps) {
  return (
    <div className={cn(bulletPointVariants({ size, variant, className }))} {...props}>
      <Icon
        className={cn(
          'flex-shrink-0',
          iconColor === 'default'
            ? 'text-text-body'
            : iconColor === 'primary'
              ? 'text-icon-action'
              : 'text-text-on-action',
          iconSize === 'sm' ? 'h-4 w-4' : iconSize === 'md' ? 'h-5 w-5' : iconSize === 'lg' ? 'h-6 w-6' : 'h-8 w-8',
        )}
      />
      <div className="flex-grow">{label}</div>
      {value && <div className={cn('ml-auto font-medium', valueClassName)}>{value}</div>}
    </div>
  );
}
