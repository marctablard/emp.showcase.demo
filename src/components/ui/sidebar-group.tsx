'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  children: React.ReactNode;
}

export function SidebarGroup({ title, className, children, ...props }: SidebarGroupProps) {
  return (
    <div className={cn('mt-4 w-full', className)} {...props}>
      <p className="px-3 pb-1 mb-2 text-text-on-disabled border-b border-border-disabled">{title}</p>
      <div className="space-y-1 [&>*:last-child]:mb-0">{children}</div>
    </div>
  );
}
