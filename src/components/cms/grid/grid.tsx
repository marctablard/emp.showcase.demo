import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { GridData } from './schema';

export type GridProps = GridData &
  HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  };

const Grid = ({ id: _id, type: _type, columns: _columns, children, className, ...rest }: GridProps) => {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6', className)} {...rest}>
      {children}
    </div>
  );
};

export default Grid;
