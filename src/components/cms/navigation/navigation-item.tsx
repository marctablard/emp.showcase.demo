'use client';

import { Link } from '@/i18n/navigation';
import { isExternalHref, sanitizeHref } from '@/lib/sanitize-href';
import type { NavigationItemData } from './schema';

const NavigationItem = ({ title, slug, link, is_external }: NavigationItemData) => {
  const rawHref = link || (slug ? `/${slug}` : '#');
  const href = sanitizeHref(rawHref);
  // Derived from the sanitised value: `mailto:`/`tel:` and uppercase schemes
  // must leave through the plain anchor, not the rewriting i18n Link.
  const isExternal = is_external || isExternalHref(href);

  // A link that sanitises away (e.g. `javascript:`) must not turn into a
  // navigable internal route — render the label inert instead.
  if (!href) {
    return <li className="text-base font-medium">{title}</li>;
  }

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
