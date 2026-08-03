import type { HTMLAttributes } from 'react';
import { Heading } from '@/components/ui/h';
import { cn } from '@/lib/utils';
import type { FeatureData } from './schema';

export type FeatureProps = FeatureData & HTMLAttributes<HTMLDivElement>;

const Feature = ({ id: _id, type: _type, name, description, className, ...rest }: Readonly<FeatureProps>) => {
  return (
    <div className={cn('p-6 border rounded-md shadow-sm', className)} {...rest}>
      <Heading variant="h3" as="div">
        {name}
      </Heading>
      <p className="text-text-on-disabled">{description}</p>
    </div>
  );
};

export default Feature;
