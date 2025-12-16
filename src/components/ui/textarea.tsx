import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, maxLength, ...props }: React.ComponentProps<'textarea'>) {
  const textValue = props.value ? (props.value as string) : '';
  return (
    <div className="flex flex-col gap-2">
      <textarea
        data-slot="textarea"
        className={cn(
          'text-text-body flex w-full min-w-0 px-3 border border-border-primary rounded-sm text-base',
          'placeholder:text-base placeholder:text-text-placeholders p-3',
          'transition-all hover:border-border-action-hover hover:bg-surface-page',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
          'disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-text-on-disabled disabled:border-border-disabled',
          className,
        )}
        maxLength={maxLength}
        {...props}
      />
      <div className="text-sm text-text-placeholders">
        {textValue.length || 0}/{maxLength}
      </div>
    </div>
  );
}

export { Textarea };
