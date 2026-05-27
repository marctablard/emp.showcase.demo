import type { ComponentType, ReactNode } from 'react';
import { type CmsComponentMapKey, cmsComponentMap } from '../component-map';
import type { CMSComponent } from '../component-schema';

/**
 * Map-driven CMS component resolver: turns an agnostic `CMSComponent`
 * payload into a React tree by looking up `cmsComponentMap[type]`.
 *
 * Container components (`page` body, `segment` content_blocks, `columns` /
 * `grid` columns) carry a nested component array; the renderer resolves each
 * child recursively and hands the resolved nodes to the container via React
 * `children`. Leaf components render with their props spread. An unknown
 * discriminator renders `null` — defence-in-depth, since adapters validate
 * upstream against the per-component Zod schemas.
 *
 * Lives under `_core/` so the page-route shell and preview tooling can
 * import it without dragging a provider SDK in.
 */

const CONTAINER_CHILD_KEYS: Partial<Record<CmsComponentMapKey, 'body' | 'content_blocks' | 'columns'>> = {
  page: 'body',
  segment: 'content_blocks',
  columns: 'columns',
  grid: 'columns',
};

const isMapKey = (type: string): type is CmsComponentMapKey =>
  Object.prototype.hasOwnProperty.call(cmsComponentMap, type);

interface CmsRendererProps {
  component: CMSComponent;
}

export const CmsRenderer = ({ component }: CmsRendererProps): ReactNode => {
  const { type } = component;
  if (!isMapKey(type)) {
    return null;
  }

  const Component = cmsComponentMap[type].component as ComponentType<Record<string, unknown>>;
  const childKey = CONTAINER_CHILD_KEYS[type];
  const props = component as unknown as Record<string, unknown>;

  if (childKey) {
    const children = props[childKey];
    const resolved = Array.isArray(children)
      ? (children as CMSComponent[]).map((child) => <CmsRenderer key={child.id} component={child} />)
      : null;
    return <Component {...props}>{resolved}</Component>;
  }

  return <Component {...props} />;
};
