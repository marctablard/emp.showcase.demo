'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbBackLink,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BreadcrumbContent } from '@/lib/breadcrumb';
import { cn } from '@/lib/utils';

interface UiBreadcrumbProps extends React.ComponentProps<'nav'> {
  items: BreadcrumbContent[];
  maxItems?: number;
  disabledCategories?: boolean;
}

export function UiBreadcrumb({ items, maxItems = 2, className, disabledCategories, ...props }: UiBreadcrumbProps) {
  const t = useTranslations('common.Breadcrumb');

  // If items array is empty, don't render anything
  if (!items || items.length === 0) {
    return null;
  }

  // Ensure we always show at least 3 items if available (first, ellipsis, last)
  const effectiveMaxItems = Math.max(maxItems, 2) - 1;
  const itemsToShow = items.slice(items.length - effectiveMaxItems);
  const hiddenItems = items.slice(0, items.length - effectiveMaxItems);

  return (
    <Breadcrumb className={cn('w-full py-4', className)} {...props}>
      <BreadcrumbList>
        {/* Back button - always present */}
        <BreadcrumbItem>
          <BreadcrumbBackLink href={items[items.length - 1].href} />
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink href={'/'}>{t('homeLink')}</BreadcrumbLink>
        </BreadcrumbItem>
        {hiddenItems.length > 0 && (
          <BreadcrumbItem key="dropdown" className="flex items-center sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1">
                <MoreHorizontal className="h-4 w-4 font-bold text-primary hover:text-primary-700" aria-hidden="true" />
                <span className="sr-only">Toggle menu</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {hiddenItems.map((hiddenItem, index) => (
                  <DropdownMenuItem key={index} asChild>
                    <a
                      href={hiddenItem.href}
                      className="cursor-pointer w-full font-bold underline text-primary hover:text-primary-700"
                    >
                      {hiddenItem.label}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </BreadcrumbItem>
        )}
        {/* Breadcrumb items */}
        {hiddenItems.map((item, index) => {
          return (
            <BreadcrumbItem key={index} className="hidden sm:block">
              {disabledCategories ? (
                <BreadcrumbPage className="inline-flex items-center whitespace-nowrap text-primary [&>svg]:size-4 lg:[&>svg]:size-6 font-bold underline px-0 lg:px-0">
                  {item.label}
                  <ChevronRight className="size-4" />
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
        {itemsToShow.map((item, index) => {
          const isLastItem = index === itemsToShow.length - 1;
          return (
            <BreadcrumbItem key={index}>
              {isLastItem ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
