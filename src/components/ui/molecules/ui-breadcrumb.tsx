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
import { Link } from '@/i18n/navigation';
import type { BreadcrumbContent } from '@/lib/breadcrumb';
import { cn } from '@/lib/utils';

interface UiBreadcrumbProps extends React.ComponentProps<'nav'> {
  items: BreadcrumbContent[];
  maxItems?: number;
  disabledCategories?: boolean;
}

function BreadcrumbLabel({
  item,
  isLast,
  disabledCategories,
}: {
  item: BreadcrumbContent;
  isLast: boolean;
  disabledCategories: boolean;
}) {
  if (isLast) {
    return <BreadcrumbPage>{item.label}</BreadcrumbPage>;
  }

  if (disabledCategories) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-text-body">
        {item.label}
        <ChevronRight className="h-4 w-4 text-text-placeholders" aria-hidden="true" />
      </span>
    );
  }

  return <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>;
}

export function UiBreadcrumb({
  items,
  maxItems = 2,
  className,
  disabledCategories = false,
  ...props
}: UiBreadcrumbProps) {
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
                <MoreHorizontal
                  className="h-4 w-4 font-bold text-text-action hover:text-text-action-hover"
                  aria-hidden="true"
                />
                <span className="sr-only">Toggle menu</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {hiddenItems.map((hiddenItem, index) => (
                  <DropdownMenuItem key={index} asChild={!disabledCategories}>
                    {disabledCategories ? (
                      <span className="w-full px-2 py-1.5 text-sm text-text-body">{hiddenItem.label}</span>
                    ) : (
                      <Link
                        href={hiddenItem.href}
                        className="cursor-pointer w-full font-bold underline text-text-action hover:text-text-action-hover"
                      >
                        {hiddenItem.label}
                      </Link>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="h-4 w-4 text-text-placeholders" aria-hidden="true" />
          </BreadcrumbItem>
        )}
        {/* Breadcrumb items */}
        {hiddenItems.map((item, index) => (
          <BreadcrumbItem key={index} className="hidden sm:block">
            <BreadcrumbLabel item={item} isLast={false} disabledCategories={disabledCategories} />
          </BreadcrumbItem>
        ))}
        {itemsToShow.map((item, index) => {
          const isLastItem = index === itemsToShow.length - 1;
          return (
            <BreadcrumbItem key={index}>
              <BreadcrumbLabel item={item} isLast={isLastItem} disabledCategories={disabledCategories} />
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
