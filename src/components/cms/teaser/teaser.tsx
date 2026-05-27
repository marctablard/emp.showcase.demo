import type { HTMLAttributes } from 'react';
import { H2 } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { TeaserData } from './schema';

export type TeaserProps = TeaserData & HTMLAttributes<HTMLDivElement>;

const Teaser = ({ id: _id, type: _type, headline, className, ...rest }: TeaserProps) => {
  return (
    <div className={cn('p-6 bg-surface-disabled rounded-md shadow-sm text-center mb-6', className)} {...rest}>
      <H2 variant="h6" className="mb-4">
        {headline || 'Hello world!'}
      </H2>
    </div>
  );
};

export default Teaser;
