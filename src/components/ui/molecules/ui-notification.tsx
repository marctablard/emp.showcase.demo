import React from 'react';
import { InfoIcon } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UINotificationProps {
  /**
   * The icon to display in the notification
   * @default InfoIcon
   */
  icon?: LucideIcon;

  /**
   * The size of the icon in pixels
   * @default 24
   */
  iconSize?: number;

  /**
   * Additional CSS classes for the notification container
   */
  className?: string;

  /**
   * Whether to animate the notification
   * @default 'none'
   */
  animate?: 'spin' | 'pulse' | 'none';
}

/**
 * UI Notification component that displays a notification bubble with an icon
 */
export function UINotification({
  icon: Icon = InfoIcon,
  iconSize = 24,
  className,
  animate = 'none',
}: UINotificationProps) {
  return (
    <div
      className={cn(
        'transition-all duration-500 bg-surface-action rounded-ss-md rounded-es-md rounded-ee-md p-2 shadow-xl',
        className,
      )}
    >
      <Icon
        className={cn(
          'text-icon-on-action',
          animate === 'pulse' && 'animate-pulse',
          animate === 'spin' && 'animate-spin',
        )}
        size={iconSize}
      />
    </div>
  );
}

export default UINotification;
