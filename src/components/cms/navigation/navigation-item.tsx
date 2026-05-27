'use client';

import { Link } from '@/i18n/navigation';
import type { NavigationItemData } from './schema';

const NavigationItem = ({ title, slug, link, is_external }: NavigationItemData) => {
  const isExternal = is_external || (link && link.startsWith('http'));
  const href = link || (slug ? `/${slug}` : '#');

  return (
    <li className="text-base font-medium">
      {isExternal ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text-action-hover transition-colors"
        >
          {title}
        </a>
      ) : (
        <Link href={href} className="hover:text-text-action-hover transition-colors">
          {title}
        </Link>
      )}
    </li>
  );
};

export default NavigationItem;
