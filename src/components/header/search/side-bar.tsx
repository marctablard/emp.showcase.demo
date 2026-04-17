import React from 'react';
import { MarkedText } from '@/components/header/search/marked-text';
import { Heading } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import type { SearchSuggestions } from '@/platform/services/model/search';

export interface SideBarProps {
  categories: SearchSuggestions['categories'];
  query: string;
}

export function SideBar({ categories, query }: SideBarProps) {
  const links = [
    {
      headline: 'Services & Guides',
      links: [
        { text: 'Catalogs & Guidelines', href: '' },
        { text: 'Safety instructions', href: '' },
        { text: 'Maintenance & Support Guides', href: '' },
        { text: 'Energy Consumption calculator', href: '' },
      ],
    },
    {
      headline: 'Help & Support',
      links: [
        { text: 'FAQs', href: '' },
        { text: 'Contact us', href: '' },
        { text: 'Delivery & Returns', href: '' },
      ],
    },
  ];

  return (
    <div className="flex flex-col col-span-5 sm:col-span-1 order-1 gap-7">
      {categories?.length > 0 && (
        <div className="mb-10">
          <Heading className="mb-6" variant="h5" as="div">
            Categories
          </Heading>
          {categories.map(({ name, count }) => (
            // Todo: set correct href for categories
            <UiLink className="mb-3" key={name + count} type="Link" href="#" variant="secondary">
              <MarkedText text={name} keyword={query} />
            </UiLink>
          ))}
        </div>
      )}
      {links.map(({ headline, links }) => (
        <div className="flex flex-col" key={headline}>
          <Heading key={headline} className="mb-6" variant="h5" as="div">
            {headline}
          </Heading>
          {links.map(({ text, href }) => (
            <UiLink className="mb-3" key={text} type="Link" href={href} variant="secondary">
              {text}
            </UiLink>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SideBar;
