import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import NavigationItem from './navigation-item';
import type { NavigationData } from './schema';

export type NavigationProps = NavigationData & HTMLAttributes<HTMLElement>;

const Navigation = ({ id: _id, type: _type, items, site: _site, className, ...rest }: NavigationProps) => {
  return (
    <nav className={cn('py-4', className)} {...rest}>
      <ul className="flex space-x-6">
        {items?.map((item) => (
          <NavigationItem key={item.id} {...item} />
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;
