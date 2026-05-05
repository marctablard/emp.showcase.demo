import { useContext, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { getLogger } from '@/lib/logger/use-logger-client';
import client from '@/platform/client';
import { CMSComponent } from '@/platform/services/model/cms';
import { SiteContext } from '@/providers/SiteProvider';
import { categoryToTreeNodes } from '../lib/category-tree';
import { getComponentTypes } from '../lib/component-utils';
import { fetchCategoryTreesForSite } from '../lib/fetch-category-tree';
import { CMSContentSlot, CMSEditorMessage, CMSLayout, CMSPage, CMSSlotConfig } from '../types';

export interface UseCMSEditorMessagesOptions {
  /**
   * Page data that seeds the provider's slot state. When provided, both
   * page-owned slots and (if `initialPage.layout` is attached) layout slots
   * are used to derive the initial `slotConfig`.
   */
  initialPage?: CMSPage;
  /**
   * Layout data that seeds the provider's slot state when no `initialPage`
   * is available. Used by `EmporixCmsLayout` to render layout-level slots
   * independently from any page.
   */
  initialLayout?: CMSLayout;
  serverIsEditorMode?: boolean;
  theme?: string;
}

/**
 * Hook that manages live CMS component state via postMessage events
 * from the CMS editor using the new simplified event system.
 *
 * Handles:
 * - REQUEST_COMPONENT_TYPES → responds with available component type definitions
 * - UPDATE_SLOT             → unified handler for add/update/delete/reorder components
 * - UPDATE_LAYOUT           → updates slot configuration (add/delete/reorder/rename slots)
 * - UPDATE_METADATA         → updates page metadata
 * - HIGHLIGHT_COMPONENT     → highlights a component in the preview
 * - HIGHLIGHT_SLOT          → highlights a slot in the preview
 *
 * @returns The current slot components, metadata, editor mode, and highlight state
 */
export function useCMSLiveEditor({
  initialPage,
  initialLayout,
  serverIsEditorMode,
  theme,
}: UseCMSEditorMessagesOptions) {
  // Use server-provided editor mode if available (prevents hydration errors)
  // Otherwise detect client-side
  const isEditorMode = serverIsEditorMode ?? (typeof window !== 'undefined' && window.parent !== window);
  const missingSetup = !client.isBound('EmporixCMSComponentService');
  const locale = useLocale();
  const site = useContext(SiteContext);

  const [slotComponents, setSlotComponents] = useState<Record<string, CMSComponent[]>>(() =>
    deriveInitialSlotComponents(initialPage, initialLayout),
  );

  const [slotConfig, setSlotConfig] = useState<CMSSlotConfig[]>(() =>
    deriveInitialSlotConfig(initialPage, initialLayout),
  );

  // Store page metadata (layouts don't carry metadata)
  const [metadata, setMetadata] = useState({
    title: initialPage?.title || '',
    description: initialPage?.description || '',
    slug: initialPage?.url || '',
    url: initialPage?.url || '',
  });

  const [highlightedComponentId, setHighlightedComponentId] = useState<string | null>(null);
  const [highlightedSlotId, setHighlightedSlotId] = useState<string | null>(null);

  // Re-seed slot state when the upstream `initialLayout` / `initialPage`
  // reference changes (e.g. a nested provider hoisted its page-bundled layout
  // up to this provider). We intentionally skip the very first render —
  // state was already seeded synchronously by the `useState` initializers
  // above — and only react to subsequent changes.
  //
  // Postmessage updates from the editor also write into the same state; if a
  // postMessage-driven change has already landed, skip the reseed so we don't
  // clobber the editor's latest values.
  const lastSeenLayoutRef = useRef(initialLayout);
  const lastSeenPageRef = useRef(initialPage);
  const postMessageAppliedRef = useRef(false);
  useEffect(() => {
    if (initialLayout === lastSeenLayoutRef.current && initialPage === lastSeenPageRef.current) {
      return;
    }
    lastSeenLayoutRef.current = initialLayout;
    lastSeenPageRef.current = initialPage;
    if (postMessageAppliedRef.current) {
      return;
    }
    setSlotComponents(deriveInitialSlotComponents(initialPage, initialLayout));
    setSlotConfig(deriveInitialSlotConfig(initialPage, initialLayout));
  }, [initialLayout, initialPage]);

  useEffect(() => {
    if (missingSetup) {
      return;
    }
    function handleMessage(event: MessageEvent) {
      const data = event.data as CMSEditorMessage | undefined;
      if (!data?.type) return;
      // Kept at `debug` so production builds stay quiet. Pass the
      // structured object to the logger rather than pre-stringifying —
      // the logger (pino under the hood) handles serialization and
      // level filtering more efficiently.
      switch (data.type) {
        case 'REQUEST_COMPONENT_TYPES':
          const componentTypes = getComponentTypes(theme);
          console.log(componentTypes);
          event.source?.postMessage(
            {
              type: 'COMPONENT_TYPES',
              componentTypes,
            },
            { targetOrigin: '*' },
          );
          break;

        case 'UPDATE_SLOT':
          postMessageAppliedRef.current = true;
          setSlotComponents((prev) => {
            const updatedSlotComponents = { ...prev };
            data.slots.forEach(({ slotId, components }) => {
              updatedSlotComponents[slotId] = components;
            });
            return updatedSlotComponents;
          });
          break;

        case 'UPDATE_LAYOUT':
          postMessageAppliedRef.current = true;
          setSlotConfig(data.slots);
          break;

        case 'UPDATE_METADATA':
          setMetadata(data.metadata);
          break;

        case 'HIGHLIGHT_COMPONENT':
          setHighlightedComponentId(data.componentId);
          break;

        case 'HIGHLIGHT_SLOT':
          setHighlightedSlotId(data.slotId);
          break;

        case 'REQUEST_CATEGORY_TREE': {
          // The storefront owns locale/site context — derive roots from the
          // site's published catalogs. Respond asynchronously so we don't
          // block the message loop.
          const { requestId } = data;
          const source = event.source;
          (async () => {
            try {
              if (!site) {
                throw new Error('Categories not configured for this site — SiteContext is empty');
              }
              const trees = await fetchCategoryTreesForSite(site);
              const categories = categoryToTreeNodes(trees, locale);
              source?.postMessage(
                {
                  type: 'CATEGORY_TREE_RESPONSE',
                  categories,
                  ...(requestId && { requestId }),
                },
                { targetOrigin: '*' },
              );
            } catch (err) {
              getLogger().error('Failed to serve CATEGORY_TREE_RESPONSE');
              source?.postMessage(
                {
                  type: 'CATEGORY_TREE_RESPONSE',
                  categories: [],
                  error: err instanceof Error ? err.message : 'Unknown error fetching categories',
                  ...(requestId && { requestId }),
                },
                { targetOrigin: '*' },
              );
            }
          })();
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);

    // Signal to the CMS editor that the iframe is ready
    const apiKey = process.env.NEXT_PUBLIC_CMS_EDITOR_API_KEY;
    window.parent.postMessage(
      {
        type: 'IFRAME_READY',
        ...(apiKey && { apiKey }),
      },
      '*',
    );

    return () => window.removeEventListener('message', handleMessage);
  }, [missingSetup, locale, site, theme]);

  return {
    missingSetup,
    slotComponents,
    slotConfig,
    metadata,
    isEditorMode,
    highlightedComponentId,
    highlightedSlotId,
  };
}

/**
 * Derive the initial `slotComponents` record from either a `CMSPage` (page
 * slots + any attached layout's layout-slot components) or a standalone
 * `CMSLayout` (its per-slot components record).
 */
function deriveInitialSlotComponents(
  page: CMSPage | undefined,
  layout: CMSLayout | undefined,
): Record<string, CMSComponent[]> {
  if (page) {
    let slots = page.contentSlots || {};
    // Fallback: if contentSlots is empty but we have a flat components array,
    // put them in 'main' so the provider has at least one slot to render.
    if (Object.keys(slots).length === 0 && page.components && page.components.length > 0) {
      slots = { main: page.components };
    }
    return slots;
  }
  if (layout) {
    return layout.components ?? {};
  }
  return {};
}

/**
 * Derive the initial `slotConfig` list. Prefers the attached layout's
 * declared slots (with `type: 'layout' | 'page'` from the `layout` flag) and
 * falls back to the keys of `slotComponents` when nothing else is available.
 */
function deriveInitialSlotConfig(page: CMSPage | undefined, layout: CMSLayout | undefined): CMSSlotConfig[] {
  const layoutSource = page?.layout ?? layout;
  if (layoutSource?.contentSlots?.length) {
    return layoutSource.contentSlots.map((slot: CMSContentSlot, index) => ({
      slotId: slot.id,
      name: slot.name,
      position: index,
      type: slot.layout ? ('layout' as const) : ('page' as const),
    }));
  }
  const slots = deriveInitialSlotComponents(page, layout);
  return Object.keys(slots).map((slotId, index) => ({
    slotId,
    name: slotId,
    position: index,
    type: 'page' as const,
  }));
}
