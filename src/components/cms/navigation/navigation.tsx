import type { HTMLAttributes } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { NavigationData } from './schema';

export type NavigationProps = NavigationData & HTMLAttributes<HTMLElement>;

const Navigation = ({ id: _id, type: _type, items, site: _site, className, ...rest }: NavigationProps) => {
  return (
    <nav className={cn('py-4', className)} {...rest}>
      <ul className="flex space-x-6">
        {items?.map((item) => {
          const isExternal = item.is_external || (item.link && item.link.startsWith('http'));
          const href = item.link || (item.slug ? `/${item.slug}` : '#');

          return (
            <li key={item.id} className="text-base font-medium">
              {isExternal ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-text-action-hover transition-colors"
                >
                  {item.title}
                </a>
              ) : (
                <Link href={href} className="hover:text-text-action-hover transition-colors">
                  {item.title}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Navigation;
