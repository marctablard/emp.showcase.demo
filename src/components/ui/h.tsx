import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const headingVariants = cva('text-text-headings font-headlines', {
  variants: {
    variant: {
      h1: 'text-7xl',
      h2: 'text-6xl',
      h3: 'text-5xl',
      h4: 'text-4xl',
      h5: 'text-3xl',
      h6: 'text-2xl',
      overline: 'text-xl md:text-text-action uppercase tracking-widest',
    },
  },
});

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  asChild?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div';
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant, as, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : as || (variant as string) || 'h1';
    return <Comp className={cn(headingVariants({ variant, className }))} ref={ref} {...props} />;
  },
);

Heading.displayName = 'Heading';

const H1 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h1', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h1" className={className} {...props} />;
  },
);
H1.displayName = 'H1';

const H2 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h2', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h2" className={className} {...props} />;
  },
);
H2.displayName = 'H2';

const H3 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h3', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h3" className={className} {...props} />;
  },
);
H3.displayName = 'H3';

const H4 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h4', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h4" className={className} {...props} />;
  },
);
H4.displayName = 'H4';

const H5 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h5', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h5" className={className} {...props} />;
  },
);
H5.displayName = 'H5';

const H6 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'h6', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="h6" className={className} {...props} />;
  },
);
H6.displayName = 'H6';

const Overline = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, 'as'>>(
  ({ className, variant = 'overline', ...props }, ref) => {
    return <Heading ref={ref} variant={variant} as="div" className={className} {...props} />;
  },
);
Overline.displayName = 'Overline';

export { Heading, headingVariants, H1, H2, H3, H4, H5, H6, Overline };
