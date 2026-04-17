import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderIconButtonProps {
  icon: LucideIcon;
  text: string;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function HeaderIconButton({ icon: Icon, text, className, ariaLabel, onClick, disabled }: HeaderIconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col text-icon-primary-dark items-center min-w-12 rounded-button p-0.5 hover:bg-surface-action hover:text-text-on-action transition-colors focus-visible:outline-2 focus:outline-border-focus cursor-pointer',
        disabled && 'opacity-50 cursor-default hover:bg-transparent hover:text-icon-primary-dark',
        className,
      )}
    >
      <Icon className="w-8 h-8" />
      <p className="text-sm font-bold -mt-1">{text}</p>
    </button>
  );
}
