'use client';

import { Link } from '@/i18n/navigation';
import type { NavigationItemData } from './schema';

/** Defense-in-depth: only allow known-safe href schemes. */
const SAFE_HREF_RE = /^(https?:\/\/|mailto:|tel:|\/|#)/;
const sanitizeHref = (href: string): string => (SAFE_HREF_RE.test(href) ? href : '');

const NavigationItem = ({ title, slug, link, is_external }: NavigationItemData) => {
  const isExternal = is_external || (link && link.startsWith('http'));
  const rawHref = link || (slug ? `/${slug}` : '#');
  const href = sanitizeHref(rawHref);

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
