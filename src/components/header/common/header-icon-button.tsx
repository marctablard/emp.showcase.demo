import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderIconButtonProps {
  icon: LucideIcon;
  text: string;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export function HeaderIconButton({ icon: Icon, text, className, ariaLabel, onClick }: HeaderIconButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'flex flex-col text-icon-primary-dark items-center min-w-12 rounded-button p-0.5 hover:bg-surface-action hover:text-text-on-action transition-colors focus-visible:outline-2 focus:outline-border-focus cursor-pointer',
        className,
      )}
    >
      <Icon className="w-8 h-8" />
      <p className="text-sm font-bold -mt-1">{text}</p>
    </button>
  );
}
