'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ProjectTabHeaderProps {
  title: ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Trailing action(s) shown on the right of the title (e.g. "New list"). */
  actions?: ReactNode;
}

/**
 * Shared header for the project detail list tabs (shopping lists / orders /
 * documents): a section title with an optional trailing action, and a search
 * box below — mirroring the title + search layout used by the account list
 * pages. Uses the detail-page gutter so it lines up with the other sections.
 */
export function ProjectTabHeader({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  actions,
}: ProjectTabHeaderProps) {
  return (
    <div className="space-y-3 border-b border-border-primary px-6 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-text-headings">{title}</h2>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="relative w-full max-w-[380px]">
        <Input
          placeholder={searchPlaceholder}
          endIcon={Search}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export default ProjectTabHeader;
