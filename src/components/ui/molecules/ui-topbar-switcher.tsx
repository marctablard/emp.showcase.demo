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
  disabled,
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

  // Single option: render static label without dropdown
  if (options.length === 1) {
    return (
      <span className="flex items-baseline gap-1.5 h-auto">
        <span className="flex self-center">{icon}</span>
        <span className="text-sm">{options[0].name}</span>
      </span>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          'flex items-baseline gap-1.5 h-auto normal-case focus-none hover:cursor-pointer',
          disabled ? 'pointer-events-none opacity-60' : '',
        )}
        disabled={disabled}
      >
        <span className="flex self-center">{icon}</span>
        <span className="text-sm">{options.find((option) => option.code == current)?.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onClick={() => {
              if (disabled) {
                return;
              }
              onSelected?.(option.code);
            }}
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
