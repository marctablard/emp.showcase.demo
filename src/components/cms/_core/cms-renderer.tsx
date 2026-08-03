import type { ComponentType, ReactNode } from 'react';
import { type CmsComponentMapKey, cmsComponentMap } from '../component-map';
import type { CMSComponent } from '../component-schema';

/**
 * Map-driven CMS component resolver: turns an agnostic `CMSComponent`
 * payload into a React tree by looking up `cmsComponentMap[type]`.
 *
 * Container components (`layout` / `page` body, `segment` content_blocks,
 * `columns` / `grid` columns) carry a nested component array; the renderer
 * resolves each child recursively and hands the resolved nodes to the
 * container via React `children`. Leaf components render with their props
 * spread. An unknown discriminator renders `null` — defence-in-depth, since
 * adapters validate upstream against the per-component Zod schemas.
 *
 * `content-slot` is a special discriminator with no real component: when the
 * renderer encounters it, it substitutes the slot with the threaded
 * `pageBody[]` (the page's own body). The `pageBody` prop flows down through
 * every container so a slot nested transitively (e.g. inside a `columns`
 * inside the `layout` body) still resolves. The substituted page-body
 * subtree is rendered WITHOUT `pageBody`, so a stray slot in the page body
 * cannot recurse infinitely.
 *
 * Lives under `_core/` so the page-route shell and preview tooling can
 * import it without dragging a provider SDK in.
 */

export const CONTAINER_CHILD_KEYS: Partial<Record<CmsComponentMapKey, 'body' | 'content_blocks' | 'columns'>> = {
  layout: 'body',
  page: 'body',
  segment: 'content_blocks',
  columns: 'columns',
  grid: 'columns',
};

const isMapKey = (type: string): type is CmsComponentMapKey =>
  Object.prototype.hasOwnProperty.call(cmsComponentMap, type);

interface CmsRendererProps {
  component: CMSComponent;
  /**
   * The page's own body, injected at the single `content-slot` position when
   * rendering a layout tree. Undefined when rendering a plain page body (no
   * layout) — a slot then resolves to nothing.
   */
  pageBody?: CMSComponent[];
}

export const CmsRenderer = ({ component, pageBody }: Readonly<CmsRendererProps>): ReactNode => {
  const { type } = component;

  // Slot substitution runs BEFORE the map lookup: the registered
  // `content-slot` component is a non-rendering placeholder kept only for
  // map↔union drift parity. The page body is rendered without `pageBody` so
  // a stray slot in the page body cannot re-trigger substitution.
  if (type === 'content-slot') {
    if (!pageBody) {
      return null;
    }
    return (
      <>
        {pageBody.map((child) => (
          <CmsRenderer key={child.id} component={child} />
        ))}
      </>
    );
  }

  if (!isMapKey(type)) {
    return null;
  }

  const Component = cmsComponentMap[type].component as ComponentType<Record<string, unknown>>;
  const childKey = CONTAINER_CHILD_KEYS[type];
  const props = component as unknown as Record<string, unknown>;

  if (childKey) {
    const children = props[childKey];
    const resolved = Array.isArray(children)
      ? (children as CMSComponent[]).map((child) => (
          <CmsRenderer key={child.id} component={child} pageBody={pageBody} />
        ))
      : null;
    return <Component {...props}>{resolved}</Component>;
  }

  return <Component {...props} />;
};
