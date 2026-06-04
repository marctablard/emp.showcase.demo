import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function QuoteDetailField({
  label,
  children,
  className,
  emphasize,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-text-placeholders">{label}</p>
      <div
        className={cn(
          'mt-0.5 text-sm leading-snug text-text-body',
          emphasize && 'font-bold font-headlines text-text-heading',
        )}
      >
        {children}
      </div>
    </div>
  );
}
