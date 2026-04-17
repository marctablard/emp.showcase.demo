import * as React from 'react';
import { cva } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface InputProps extends React.ComponentProps<'input'> {
  startIcon?: LucideIcon;
  endIcon?: LucideIcon;
  isButton?: boolean;
  iconButtonBefore?: LucideIcon;
  iconButtonAfter?: LucideIcon;
  buttonText?: string;
  buttonLabel?: string;
  onEndIconClick?: () => void;
  endIconLabel?: string;
}

const inputVariants = cva(
  [
    'text-text-body flex w-full min-w-0 px-3 border-width-form-field border-border-primary rounded-form-field',
    'placeholder:text-text-placeholders py-3 text-base sm:text-base',
    'transition duration-150 ease-in-out hover:text-text-action-hover hover:border-border-action-hover hover:bg-surface-primary',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-text-on-disabled',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
    'aria-invalid:text-text-error aria-invalid:border-border-error hover:aria-invalid:border-border-action-hover hover:aria-invalid:text-text-action-hover',
    'data-[success=true]:border-border-success hover:data-[success=true]:border-border-action-hover hover:data-[success=true]:text-text-action-hover',
  ],
  {
    variants: {
      isButton: {
        true: 'rounded-e-none',
        false: '',
      },
      startIcon: {
        true: 'pl-10',
        false: '',
      },
      endIcon: {
        true: 'pr-10',
        false: '',
      },
      dataDirtySuccess: {
        true: 'bg-surface-success hover:border-border-action-hover hover:text-text-action-hover',
        false: '',
      },
      dataDirtyError: {
        true: 'bg-surface-error hover:border-border-action-hover hover:text-text-action-hover',
        false: '',
      },
    },
    defaultVariants: {
      isButton: false,
      startIcon: false,
      endIcon: false,
      dataDirtySuccess: false,
      dataDirtyError: false,
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, isButton, onEndIconClick, endIconLabel, ...props }, ref) => {
    const StartIcon = startIcon;
    const EndIcon = endIcon;
    const dataSuccess = 'data-success' in props ? (props['data-success'] as boolean) : false;
    const dataDirtySuccess = 'data-dirty-success' in props ? (props['data-dirty-success'] as boolean) : false;
    const dataDirtyError = 'data-dirty-error' in props ? (props['data-dirty-error'] as boolean) : false;

    return (
      <div
        className={cn(
          'w-full h-full relative',
          'transition hover:text-text-action-hover hover:bg-surface-primary',
          dataSuccess && 'text-text-success border-border-success',
          props.disabled && 'text-text-on-disabled border-border-disabled hover:text-text-on-disabled',
          props['aria-invalid'] && 'border-border-error text-text-error',
        )}
      >
        {StartIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 border-none">
            <StartIcon size={24} />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          data-slot="input"
          className={cn(
            inputVariants({
              isButton: !!isButton,
              startIcon: !!startIcon,
              endIcon: !!endIcon,
              dataDirtySuccess: !!dataDirtySuccess,
              dataDirtyError: !!dataDirtyError,
              className,
            }),
          )}
          {...props}
        />

        {EndIcon && onEndIconClick && (
          <div
            className={cn(
              'absolute right-3 top-1/2 transform -translate-y-1/2',
              'cursor-pointer hover:text-text-action-hover',
            )}
            onClick={onEndIconClick}
            tabIndex={0}
            role="button"
            aria-label={endIconLabel}
          >
            <EndIcon size={24} />
          </div>
        )}
        {EndIcon && !onEndIconClick && (
          <div className={cn('absolute right-3 top-1/2 transform -translate-y-1/2')}>
            <EndIcon size={24} />
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

const InputButton = React.forwardRef<HTMLInputElement, InputProps>(
  ({ startIcon, endIcon, iconButtonBefore, iconButtonAfter, buttonText, buttonLabel, ...props }, ref) => {
    const ButtonStartIcon = iconButtonBefore;
    const ButtonEndIcon = iconButtonAfter;
    return (
      <div className={cn('flex items-center')}>
        <Input ref={ref} startIcon={startIcon} endIcon={endIcon} isButton {...props} />
        <Button variant="input" aria-label={buttonLabel}>
          {ButtonStartIcon && <ButtonStartIcon />}
          {buttonText}
          {ButtonEndIcon && <ButtonEndIcon />}
        </Button>
      </div>
    );
  },
);

InputButton.displayName = 'InputButton';

export { Input, InputButton, inputVariants };
