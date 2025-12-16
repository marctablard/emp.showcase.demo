'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function TopBarSwitcher({
  options,
  current,
  label,
  onSelected,
  icon,
}: React.ComponentProps<'button'> & {
  options: {
    code: string;
    name: string;
  }[];
  current: string;
  label: string;
  onSelected?: (code: string) => void;
  icon?: React.ReactNode;
}) {
  if (!options || options.length === 0 || !current) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex items-baseline gap-1.5 h-auto normal-case focus-none hover:cursor-pointer"
      >
        <span className="flex self-center">{icon}</span>
        <span className="text-sm">{options.find((option) => option.code == current)?.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onClick={() => onSelected?.(option.code)}
            className={cn(
              'hover:cursor-pointer',
              option.code === current ? 'bg-surface-action-hover-2 text-text-action-hover' : '',
            )}
          >
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
