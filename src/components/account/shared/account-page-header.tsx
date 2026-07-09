import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AccountPageHeaderProps {
  /** Small uppercase label rendered above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Optional supporting copy rendered below the title. */
  description?: ReactNode;
  /** Rendered inline next to the title (e.g. a status badge). */
  badge?: ReactNode;
  /** Rendered on the trailing edge of the header (e.g. primary actions). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard title block for account list and form pages.
 *
 * Mirrors the order-detail header language (uppercase eyebrow + heading) so
 * every account page shares the same title scale and spacing. The title uses
 * `text-3xl` — one step above the detail-page entity title, per the agreed
 * "title a little bigger" guidance.
 */
export function AccountPageHeader({ eyebrow, title, description, badge, actions, className }: AccountPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-text-placeholders">{eyebrow}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-text-headings">{title}</h1>
          {badge}
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm text-text-placeholders">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default AccountPageHeader;
