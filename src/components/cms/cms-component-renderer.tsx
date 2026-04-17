'use client';

import dynamic from 'next/dynamic';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { CMSComponent } from '@/platform/services/model/cms';

// Dynamically import components
const Hero = dynamic(() => import('./hero'));
const QuickEntry = dynamic(() => import('./quick-entry'));
const ColumnTeaser = dynamic(() => import('./column-teaser'));
const Recommendations = dynamic(() => import('./recommendations'));

// Map of component types to their React components
const componentMap: Record<string, React.ComponentType<any>> = {
  hero: Hero,
  'quick-entry': QuickEntry,
  'column-teaser': ColumnTeaser,
  recommendations: Recommendations,
};

interface CMSComponentRendererProps {
  components: CMSComponent[];
  locale?: string;
}

/**
 * Renders CMS components based on their type
 */
export default function CMSComponentRenderer({ components, locale }: CMSComponentRendererProps) {
  return (
    <>
      {components.map((component) => {
        const Component = componentMap[component.type];

        if (!Component) {
          getLogger().warn({ componentType: component.type }, 'Component type not found');
          return null;
        }

        return <Component key={component.id} {...component} locale={locale} />;
      })}
    </>
  );
}
