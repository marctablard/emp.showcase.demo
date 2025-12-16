'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDownIcon, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  startIcon?: LucideIcon;
  endIcon?: LucideIcon;
}

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" className="text-text-body" {...props} />;
}

function SelectTrigger({ className, children, disabled, startIcon, ...props }: SelectProps) {
  const StartIcon = startIcon;
  const dataDirtySuccess = 'data-dirty-success' in props ? (props['data-dirty-success'] as boolean) : false;
  const dataDirtyError = 'data-dirty-error' in props ? (props['data-dirty-error'] as boolean) : false;

  return (
    <div
      className={cn(
        'w-full relative ',
        'transition-all hover:text-text-action-hover hover:bg-surface-page',
        dataDirtySuccess && 'text-text-success border-border-success',
        props['aria-invalid'] && 'border-border-error text-text-error',
        disabled && 'hover:text-text-on-disabled',
      )}
    >
      {StartIcon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 border-none text-icon-neutral">
          <StartIcon size={20} />
        </div>
      )}

      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          'text-text-body group flex justify-between items-center w-full min-w-0 px-3 border border-border-primary rounded-sm',
          'transition duration-150 ease-in-out hover:border-border-action-hover hover:text-text-action-hover hover:bg-surface-page',
          startIcon && 'pl-10',
          disabled &&
            'bg-surface-disabled text-text-on-disabled border-border-disabled hover:text-text-on-disabled hover:bg-surface-disabled hover:border-border-disabled pointer-events-none',
          'data-[state=open]:outline-2 data-[state=open]:outline-offset-2 data-[state=open]:outline-border-focus',
          'aria-invalid:text-text-error aria-invalid:border-border-error hover:aria-invalid:border-border-action-hover hover:aria-invalid:text-text-action-hover',
          "data-[placeholder]:text-text-placeholders flex w-full text-base py-3 [&_svg:not([class*='size-'])]:size-5",
          dataDirtySuccess &&
            'bg-surface-success border-border-success hover:border-border-action-hover hover:text-text-action-hover',
          dataDirtyError && 'bg-surface-error hover:border-border-action-hover hover:text-text-action-hover',
          className,
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon
            className={cn(
              'size-4 text-icon-neutral transition-transform duration-200 group-data-[state=open]:rotate-180',
            )}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    </div>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'mt-1 bg-surface-page data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-sm border',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1 divide-y',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn('text-text-headings', className)} {...props} />;
}

function SelectItem({
  className,
  children,
  disabled,
  startIcon,
  endIcon,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & SelectProps) {
  const StartIcon = startIcon;
  const EndIcon = endIcon;

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'flex items-center w-full p-3 gap-3 outline-hidden ',
        disabled && 'bg-surface-disabled border-border-disabled text-text-on-disabled pointer-events-none',
        'transition-all hover:text-text-action-hover hover:bg-surface-action-hover-2 focus:text-text-action-hover focus:bg-surface-action-hover-2',
        disabled && 'hover:bg-surface-disabled hover:text-text-on-disabled',
        'data-[state=checked]:bg-surface-action data-[state=checked]:text-text-on-action hover:data-[state=checked]:bg-surface-action-hover',
        className,
      )}
      {...props}
    >
      {StartIcon && <StartIcon size={20} />}

      <div
        className={cn(
          'w-full cursor-default select-none data-[disabled]:pointer-events-none',
          "hover:text-text-action-hover'",
          className,
        )}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </div>

      {EndIcon && <EndIcon size={20} />}
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-border-primary pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue };
