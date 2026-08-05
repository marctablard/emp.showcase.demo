import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeftIcon, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      className="relative [@media_screen]:after:content-[''] after:absolute after:top-0 after:right-0 after:w-8 after:h-full after:bg-gradient-to-r after:from-transparent after:to-surface-page"
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        // min-[992px]: Figma desktop; project `md` is 1024px and misses 992 capture
        'text-sm min-[992px]:text-base text-text-body flex items-center gap-1 overflow-x-auto overflow-y-scroll max-w-[calc(100vw-2rem)] scroll-smooth hide-scrollbar',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="breadcrumb-item" className={cn('inline-flex items-center gap-1', className)} {...props} />;
}

function BreadcrumbLink({ className, children, href, ...props }: React.ComponentProps<'a'>) {
  return (
    <Link
      href={href as string}
      data-slot="breadcrumb-link"
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-text-action [&>svg]:size-4 min-[992px]:[&>svg]:size-6 font-bold underline hover:text-text-action-hover outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span data-slot="breadcrumb-page" aria-current="page" className={cn('whitespace-nowrap', className)} {...props} />
  );
}

function BreadcrumbBackLink({ className, href, ...props }: React.ComponentProps<'a'>) {
  const t = useTranslations('common.Breadcrumb');
  return (
    <Link
      href={href as string}
      data-slot="breadcrumb-back-link"
      className={cn(
        'flex font-bold items-center justify-center gap-1 pr-4 underline cursor-pointer hover:text-text-action-hover outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-4 min-[992px]:size-6" aria-hidden="true" />
      <span>{t('backLink')}</span>
    </Link>
  );
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbBackLink };
