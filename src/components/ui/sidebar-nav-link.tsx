'use client';

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

const sidebarNavLinkVariants = cva(
  'h-11 flex items-center justify-between w-full py-2 px-3 text-base transition-colors mb-2 group',
  {
    variants: {
      variant: {
        default: '',
        active: 'bg-surface-action-hover-2 border-l-4 border-border-action-hover',
        primary: 'hover:bg-surface-action text-text-action',
        destructive: 'text-text-error hover:bg-surface-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface SidebarNavLinkProps extends VariantProps<typeof sidebarNavLinkVariants> {
  href: string;
  icon?: React.ReactNode;
  text: string;
  counter?: number;
  badgeVariant?: 'primary' | 'success';
  active?: boolean;
  onClick?: () => void;
  isLogout?: boolean;
  className?: string;
}

export function SidebarNavLink({
  href,
  icon,
  text,
  counter,
  className,
  variant,
  badgeVariant = 'primary',
  active,
  onClick,
  isLogout,
  ...props
}: SidebarNavLinkProps) {
  const activeVariant = active ? 'active' : variant || 'default';
  const linkClassName = cn(sidebarNavLinkVariants({ variant: activeVariant }), className);
  if (isLogout || onClick) {
    return (
      <button type="button" className={linkClassName} onClick={onClick} {...props}>
        <div className="flex items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <span className="group-hover:underline">{text}</span>
        </div>
      </button>
    );
  }

  return (
    <Link href={href} className={linkClassName} {...props}>
      <div className="flex items-center gap-3">
        {icon && <div className="w-6 h-6 shrink-0">{icon}</div>}
        <span className="group-hover:underline">{text}</span>
        {typeof counter === 'number' && (
          <Badge
            variant={badgeVariant === 'success' ? 'success' : 'information'}
            className={`rounded-full  font-bold w-[20px] h-[20px] flex justify-center items-center p-0`}
          >
            {counter}
          </Badge>
        )}
      </div>
    </Link>
  );
}
