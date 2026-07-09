import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bordered detail container used by order / quote / approval / return detail
 * pages. A single framed surface whose child sections are separated by
 * horizontal dividers — the shared "detail" language of the account area.
 */
export function AccountDetailContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <article className={cn('border border-border-primary bg-surface-page', className)}>{children}</article>;
}

interface AccountDetailHeaderProps {
  /** Small uppercase label rendered above the title (e.g. "Order details"). */
  eyebrow?: ReactNode;
  /** Primary title — typically the entity identifier (e.g. "#12345"). */
  title: ReactNode;
  /** Trailing content such as a status label + badge. */
  aside?: ReactNode;
  className?: string;
}

/**
 * Detail-page header: uppercase eyebrow + entity title, with an optional
 * trailing aside (status). The title is `text-3xl` to match the standardized
 * account title scale.
 */
export function AccountDetailHeader({ eyebrow, title, aside, className }: AccountDetailHeaderProps) {
  return (
    <header className={cn('border-b border-border-primary px-4 py-4 sm:px-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-placeholders">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 text-3xl font-bold text-text-headings">{title}</h1>
        </div>
        {aside ? (
          <div className="flex items-center gap-3 border-l-0 border-border-primary sm:border-l sm:pl-6">{aside}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Status label + badge shown in a detail header aside. */
export function AccountDetailStatus({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="text-sm font-medium text-text-placeholders">{label}</span>
      {children}
    </>
  );
}

/**
 * Section header bar (uppercase label on a muted surface) used to introduce a
 * table or block inside a detail container.
 */
export function AccountSectionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-b border-border-primary bg-surface-image-background px-4 py-2 sm:px-6', className)}>
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-text-headings">{children}</h2>
    </div>
  );
}

/**
 * A divider-wrapped block within a detail container. Use for custom content
 * (footers, comment boxes) that isn't a spec table or item table.
 */
export function AccountDetailSection({
  className,
  divider = true,
  children,
}: {
  className?: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(divider && 'border-b border-border-primary', 'px-4 py-4 sm:px-6', className)}>
      {children}
    </section>
  );
}

/** Uppercase label used to head an in-section block (e.g. "Order actions"). */
export function AccountSectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn('text-xs font-bold uppercase tracking-[0.08em] text-text-headings', className)}>{children}</p>
  );
}
