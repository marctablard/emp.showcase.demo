import { Children, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ColumnsData } from './schema';

export type ColumnsProps = ColumnsData &
  HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
  };

const Columns = ({ id: _id, type: _type, columns: _columns, children, className, ...rest }: Readonly<ColumnsProps>) => {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-4', className)} {...rest}>
      {Children.map(children, (child) => (
        <div className="flex-1">{child}</div>
      ))}
    </div>
  );
};

export default Columns;
