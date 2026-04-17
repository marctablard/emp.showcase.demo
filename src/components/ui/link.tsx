'use client';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const linkVariants = cva(
  'outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white',
  {
    variants: {
      variant: {
        primary:
          'inline-flex items-center gap-1 text-text-action font-bold underline hover:text-text-action-hover disabled:text-text-disabled disabled:[&_svg]:text-text-disabled',
        secondary:
          'inline-flex items-center gap-1 text-text-body hover:underline hover:text-text-action disabled:hover:no-underline disabled:text-text-disabled disabled:[&_svg]:text-text-disabled',
        text: 'text-text-action underline hover:text-text-action-hover',
        textNoUnderline: 'text-text-action no-underline hover:text-text-action-hover',
        buttonPrimary:
          'cursor-pointer uppercase inline-flex items-center justify-center gap-3 whitespace-nowrap px-4 py-3 text-base tracking-widest font-bold transition-all disabled:pointer-events-none disabled:bg-surface-disabled disabled:text-text-on-disabled [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 bg-surface-action text-text-on-action border border-transparent hover:bg-surface-action-hover rounded-button',
        buttonSecondary:
          'cursor-pointer uppercase inline-flex items-center justify-center gap-3 whitespace-nowrap px-4 py-3 text-action-button tracking-widest font-bold transition-all disabled:pointer-events-none disabled:bg-surface-disabled disabled:text-text-on-disabled [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white border-width-button border-border-secondary bg-transparent text-text-action disabled:border-border-disabled hover:border-border-action-hover hover:bg-surface-action-hover-2 hover:text-text-action-hover rounded-button',
        footerLegal: 'text-text-on-action hover:underline hover:text-text-on-action',
        clean: '',
      },
      size: {
        s: 'text-sm [&_svg]:w-4 [&_svg]:h-4',
        m: 'text-base ',
        l: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

interface LinkProps {
  type: 'Button' | 'A' | 'Link';
  href?: string;
  disabled?: boolean;
  iconBefore?: React.ReactNode | undefined;
  iconAfter?: React.ReactNode | undefined;
  children?: React.ReactNode | undefined;
  className?: string;
  onClick?: () => void;
  target?: string;
  replace?: boolean;
}

export default function UiLink({
  variant,
  size,
  type,
  iconBefore,
  iconAfter,
  href = '#',
  className,
  onClick,
  target,
  replace,
  ...props
}: LinkProps &
  VariantProps<typeof linkVariants> & {
    asChild?: boolean;
  }) {
  const classes = linkVariants({ variant, size, className });
  switch (type) {
    case 'Link':
      return (
        <Link href={href} target={target} className={classes} onClick={onClick} replace={replace} {...props}>
          {iconBefore}
          {props.children}
          {iconAfter}
        </Link>
      );
    case 'A':
      return (
        <a href={href} target={target} className={classes} onClick={onClick} {...props}>
          {iconBefore}
          {props.children}
          {iconAfter}
        </a>
      );
    case 'Button':
      return (
        <button type="button" className={cn('cursor-pointer', classes)} onClick={onClick} {...props}>
          {iconBefore}
          {props.children}
          {iconAfter}
        </button>
      );
  }
}
