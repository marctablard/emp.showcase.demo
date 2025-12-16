'use client';

import { storyblokEditable } from '@storyblok/react/rsc';
import { Link } from '@/i18n/navigation';

/**
 * Navigation component for Storyblok
 * Displays a navigation menu with links
 */
interface NavigationItem {
  _uid: string;
  title: string;
  slug?: string;
  link?: string;
  is_external?: boolean;
  site?: string;
}

interface NavigationProps {
  blok: {
    items?: NavigationItem[];
    site?: string;
  };
}

const Navigation = ({ blok }: NavigationProps) => {
  return (
    <nav {...storyblokEditable(blok)} className="py-4">
      <ul className="flex space-x-6">
        {blok.items?.map((item) => {
          const isExternal = item.is_external || (item.link && item.link.startsWith('http'));
          const href = item.link || (item.slug ? `/${item.slug}` : '#');

          return (
            <li key={item._uid} className="text-base font-medium">
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
