import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('flex flex-row items-center gap-2', className)} {...props} />;
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  isActive?: boolean;
} & React.ComponentProps<'a'>;

function PaginationLink({ disabled, className, isActive, ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      aria-disabled={disabled || false}
      className={cn(
        'inline-flex items-center justify-center gap-3 whitespace-nowrap min-w-10 h-10 p-2 cursor-pointer uppercase text-action-button tracking-widest transition-all rounded-button shrink-0 [&_svg]:shrink-0 bg-transparent text-text-action border-width-button border-transparent disabled:border-border-disabled hover:border-border-action-hover hover:bg-surface-action-hover-2 hover:text-text-action-hover outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:border-border-action',
        isActive && 'border-border-action',
        disabled && 'pointer-events-none bg-surface-disabled text-text-on-disabled [&_svg]:pointer-events-none',
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ ...props }: { disabled?: boolean; className?: string } & React.ComponentProps<'a'>) {
  return (
    <PaginationLink aria-label="Go to previous page" {...props}>
      <ChevronLeftIcon />
    </PaginationLink>
  );
}

function PaginationNext({ ...props }: { disabled?: boolean; className?: string } & React.ComponentProps<'a'>) {
  return (
    <PaginationLink aria-label="Go to next page" {...props}>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({ ...props }: React.ComponentProps<'span'>) {
  return (
    <span aria-hidden data-slot="pagination-ellipsis" {...props}>
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
