import { useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { getLogger } from '@/lib/logger/use-logger-client';
import client from '@/platform/client';
import type { CMSComponent } from '@/platform/services/model/cms';
import { SiteContext } from '@/providers/SiteProvider';
import { categoryToTreeNodes } from '../lib/category-tree';
import { getComponentTypes } from '../lib/component-utils';
import { fetchCategoryTreesForSite } from '../lib/fetch-category-tree';
import { fetchProductSearch } from '../lib/fetch-product-search';
import type { CMSComponentDecoratorService } from '../services/CMSComponentDecoratorService';
import type { CMSContentSlot, CMSEditorMessage, CMSLayout, CMSPage, CMSSlotConfig } from '../types';

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

type EditorMetadata = { title: string; description: string; slug: string; url: string };

// === Singleton overlay store ===
//
// One DOM listener + one shared overlay layered on top of each provider's
// per-instance seed. Per-provider seeds keep SSR hydration deterministic;
// the shared overlay lets editor edits apply uniformly across every
// mounted `EmporixCMSProvider`.

type EditorOverlay = {
  // For `slotComponents`: a key present here overrides the seed for that
  // slotId. Missing keys fall through to the seed.
  slotComponents: Record<string, CMSComponent[]>;
  // `null` means "no override" — fall through to seed.
  slotConfig: CMSSlotConfig[] | null;
  metadata: EditorMetadata | null;
  highlightedComponentId: string | null;
  highlightedSlotId: string | null;
};

const emptyOverlay: EditorOverlay = {
  slotComponents: {},
  slotConfig: null,
  metadata: null,
  highlightedComponentId: null,
  highlightedSlotId: null,
};

let overlay: EditorOverlay = emptyOverlay;
const overlayListeners = new Set<() => void>();

// Request handlers (REQUEST_COMPONENT_TYPES, REQUEST_CATEGORY_TREE) need
// access to the active locale/site/theme. All providers in a single React
// tree share these, so last-write-wins is safe.
type RequestContext = { theme?: string; locale: string; site: string | undefined };
let requestContext: RequestContext | null = null;

let listenerAttached = false;
let attachedCount = 0;
// Serial queue for `UPDATE_SLOT` handling. Decoration may hit the network
// (`mw-header` fetches the category tree), so back-to-back edits chain
// onto this promise to preserve apply-order even if earlier decorations
// resolve later than newer ones.
let slotDecorationQueue: Promise<void> = Promise.resolve();
// Deferred-teardown gate. Starts `true` so the first ever attach posts
// `IFRAME_READY`. Flips back to `true` only after a teardown actually
// completes (i.e. nothing remounted within the cancellation window),
// which is what distinguishes a real SPA nav from React Strict Mode's
// dev-only unmount→remount.
let fullyTornDown = true;
let pendingTeardownTimer: ReturnType<typeof setTimeout> | null = null;

function subscribeOverlay(listener: () => void) {
  overlayListeners.add(listener);
  return () => {
    overlayListeners.delete(listener);
  };
}

function getOverlay(): EditorOverlay {
  return overlay;
}

function emitOverlayChange() {
  for (const listener of Array.from(overlayListeners)) listener();
}

// Stable refs for the iframe-detection `useSyncExternalStore` call. The
// value never actually changes during a session (you're either in an iframe
// or you're not), so subscribe is a no-op; getServerSnapshot returns `false`
// to match SSR HTML, getSnapshot returns the live value on the client.
const noopSubscribe = () => () => {};
const getIframeSnapshot = () => window.parent !== window;
const getIframeServerSnapshot = () => false;

function attachProvider() {
  // If a teardown was scheduled but hasn't run yet, this remount cancels it.
  // That's how we collapse React Strict Mode's dev-only unmount→remount into
  // a no-op: the gap between the two phases is shorter than a macrotask, so
  // the timer never fires and `fullyTornDown` never flips back to `true`.
  if (pendingTeardownTimer !== null) {
    clearTimeout(pendingTeardownTimer);
    pendingTeardownTimer = null;
    attachedCount++;
    return;
  }

  attachedCount++;
  if (typeof window === 'undefined') return;
  if (!listenerAttached) {
    window.addEventListener('message', handleEditorMessage);
    listenerAttached = true;
  }
  if (fullyTornDown) {
    fullyTornDown = false;
    // Genuine activation (initial mount, or remount after a fully completed
    // teardown). Signal to the editor that the iframe is ready.
    const apiKey = process.env.NEXT_PUBLIC_CMS_EDITOR_API_KEY;
    const message = {
      type: 'IFRAME_READY',
      ...(apiKey && { apiKey }),
    };
    window.parent.postMessage(message, '*');
  }
}

function detachProvider() {
  attachedCount = Math.max(0, attachedCount - 1);
  if (attachedCount !== 0) return;

  // Defer the actual teardown so a Strict Mode remount can cancel it.
  // setTimeout(0) yields to the next macrotask — long enough for React's
  // synchronous unmount→remount dance, short enough that real SPA nav
  // still sees a clean state.
  if (pendingTeardownTimer !== null) clearTimeout(pendingTeardownTimer);
  pendingTeardownTimer = setTimeout(() => {
    pendingTeardownTimer = null;
    if (attachedCount !== 0) return;
    fullyTornDown = true;
    if (overlay !== emptyOverlay) {
      overlay = emptyOverlay;
      emitOverlayChange();
    }
  }, 0);
}

// Reset the overlay when the active page identity changes. Called by the
// hook when its `initialPage` reference changes mid-mount (e.g. SPA nav
// keeps a layout provider mounted while the page provider re-seeds).
function resetOverlayForNewPage() {
  if (overlay === emptyOverlay) return;
  overlay = emptyOverlay;
  emitOverlayChange();
}

function handleEditorMessage(event: MessageEvent) {
  const data = event.data as CMSEditorMessage | undefined;
  if (!data?.type) return;

  switch (data.type) {
    case 'REQUEST_COMPONENT_TYPES': {
      const componentTypes = getComponentTypes(requestContext?.theme);
      const response = {
        type: 'COMPONENT_TYPES' as const,
        componentTypes,
      };
      event.source?.postMessage(response, { targetOrigin: '*' });
      break;
    }

    case 'UPDATE_SLOT': {
      // Components arriving from the editor are **raw** — they bypass
      // `EmporixCMSService.getPage`, which is where SSR runs server-side
      // decoration (e.g. attaching `_category_tree` for `mw-header`).
      // Re-run that decoration here against the client DI container so
      // components rendered in editor mode look identical to their SSR
      // counterparts. Falls back to writing raw components when no
      // decorator is registered or no site context is available, so the
      // overlay still updates and visible regressions are limited to
      // the decorated extras themselves.
      const slotsToApply = data.slots;
      const ctx = requestContext;
      const writeRaw = () => {
        const updated = { ...overlay.slotComponents };
        slotsToApply.forEach(({ slotId, components }) => {
          updated[slotId] = components;
        });
        overlay = { ...overlay, slotComponents: updated };
        emitOverlayChange();
      };

      if (!ctx?.site || !client.isBound('EmporixCMSComponentDecoratorService')) {
        writeRaw();
        break;
      }

      const decorator = client.get<CMSComponentDecoratorService>('EmporixCMSComponentDecoratorService');
      const decorationCtx = { site: ctx.site, locale: ctx.locale };
      // Chain onto the queue so back-to-back edits apply in order even if
      // earlier decorations are still in flight (decoration may hit the
      // network for category trees etc.).
      slotDecorationQueue = slotDecorationQueue
        .then(async () => {
          const decorated = await Promise.all(
            slotsToApply.map(async ({ slotId, components }) => {
              const next = await Promise.all(components.map((c) => decorator.decorate(c, decorationCtx)));
              return [slotId, next] as const;
            }),
          );
          const updated = { ...overlay.slotComponents };
          for (const [slotId, components] of decorated) {
            updated[slotId] = components;
          }
          overlay = { ...overlay, slotComponents: updated };
          emitOverlayChange();
        })
        .catch((err: unknown) => {
          getLogger().error({ err }, 'Failed to decorate UPDATE_SLOT components — writing raw');
          writeRaw();
        });
      break;
    }

    case 'UPDATE_LAYOUT':
      overlay = { ...overlay, slotConfig: data.slots };
      emitOverlayChange();
      break;

    case 'UPDATE_METADATA':
      overlay = { ...overlay, metadata: data.metadata };
      emitOverlayChange();
      break;

    case 'HIGHLIGHT_COMPONENT':
      overlay = { ...overlay, highlightedComponentId: data.componentId };
      emitOverlayChange();
      break;

    case 'HIGHLIGHT_SLOT':
      overlay = { ...overlay, highlightedSlotId: data.slotId };
      emitOverlayChange();
      break;

    case 'REQUEST_CATEGORY_TREE': {
      // The storefront owns locale/site context — derive roots from the
      // site's published catalogs. Resolved by hitting our own
      // `/api/cms/categories/tree` route so the Emporix call runs
      // server-side: the public token works there without CORS or
      // browser-origin scope quirks, and a host that already exposes
      // its own `/api/categories/*` shopper surface stays unaffected
      // (the `/api/cms/...` namespace is plugin-private).
      const { requestId } = data;
      const source = event.source;
      const ctx = requestContext;
      (async () => {
        try {
          if (!ctx?.site) {
            throw new Error('Categories not configured for this site — SiteContext is empty');
          }
          const trees = await fetchCategoryTreesForSite(ctx.site);
          const categories = categoryToTreeNodes(trees, ctx.locale);
          const response = {
            type: 'CATEGORY_TREE_RESPONSE' as const,
            categories,
            ...(requestId && { requestId }),
          };
          source?.postMessage(response, { targetOrigin: '*' });
        } catch (err) {
          getLogger().error('Failed to serve CATEGORY_TREE_RESPONSE');
          const response = {
            type: 'CATEGORY_TREE_RESPONSE' as const,
            categories: [],
            error: err instanceof Error ? err.message : 'Unknown error fetching categories',
            ...(requestId && { requestId }),
          };
          source?.postMessage(response, { targetOrigin: '*' });
        }
      })();
      break;
    }

    case 'REQUEST_PRODUCT_SEARCH': {
      // Editor sends `site`/`locale` in every payload; trust those over
      // the hook's own context so the editor stays in control of which
      // tenant a debounced search resolves against.
      const { requestId, site: msgSite, locale: msgLocale, query, categoryId, limit } = data;
      const source = event.source;
      (async () => {
        try {
          const products = await fetchProductSearch({
            site: msgSite,
            locale: msgLocale,
            query,
            categoryId,
            limit,
          });
          const response = {
            type: 'PRODUCT_SEARCH_RESPONSE' as const,
            requestId,
            site: msgSite,
            locale: msgLocale,
            query,
            products,
          };
          source?.postMessage(response, { targetOrigin: '*' });
        } catch (err) {
          getLogger().error('Failed to serve PRODUCT_SEARCH_RESPONSE');
          const response = {
            type: 'PRODUCT_SEARCH_RESPONSE' as const,
            requestId,
            site: msgSite,
            locale: msgLocale,
            query,
            products: [],
            error: err instanceof Error ? err.message : 'Unknown error fetching products',
          };
          source?.postMessage(response, { targetOrigin: '*' });
        }
      })();
      break;
    }
  }
}

/**
 * Hook that manages live CMS component state via postMessage events
 * from the CMS editor.
 *
 * Architecture: a module-level singleton owns the `window` message listener,
 * the `IFRAME_READY` handshake, and the overlay state for editor-driven
 * changes. Each call to this hook seeds its own slot/metadata state
 * synchronously from props (so SSR renders correctly) and reads the shared
 * overlay via `useSyncExternalStore`. The returned shape merges seed+overlay
 * with overlay winning per slotId.
 *
 * Handles:
 * - REQUEST_COMPONENT_TYPES → responds with available component type definitions
 * - UPDATE_SLOT             → unified handler for add/update/delete/reorder components
 * - UPDATE_LAYOUT           → updates slot configuration
 * - UPDATE_METADATA         → updates page metadata
 * - HIGHLIGHT_COMPONENT     → highlights a component in the preview
 * - HIGHLIGHT_SLOT          → highlights a slot in the preview
 * - REQUEST_CATEGORY_TREE   → responds with the storefront's category tree
 * - REQUEST_PRODUCT_SEARCH  → responds with debounced product search results
 */
export function useCMSLiveEditor({
  initialPage,
  initialLayout,
  serverIsEditorMode,
  theme,
}: UseCMSEditorMessagesOptions) {
  const iframeDetected = useSyncExternalStore(noopSubscribe, getIframeSnapshot, getIframeServerSnapshot);
  const isEditorMode = serverIsEditorMode ?? iframeDetected;

  const missingSetup = !client.isBound('EmporixCMSComponentService');
  const locale = useLocale();
  const site = useContext(SiteContext);

  // Per-provider seed — pure derivation of props, recomputed when props change.
  // Synchronous in render so SSR and the first client render agree.
  const seedSlotComponents = useMemo(
    () => deriveInitialSlotComponents(initialPage, initialLayout),
    [initialPage, initialLayout],
  );
  const seedSlotConfig = useMemo(
    () => deriveInitialSlotConfig(initialPage, initialLayout),
    [initialPage, initialLayout],
  );
  const seedMetadata = useMemo<EditorMetadata>(
    () => ({
      title: initialPage?.title || '',
      description: initialPage?.description || '',
      slug: initialPage?.url || '',
      url: initialPage?.url || '',
    }),
    [initialPage],
  );

  // SPA navigation can swap `initialPage` while a parent layout provider
  // stays mounted. When the page identity changes, wipe the editor overlay
  // so stale UPDATE_SLOT data from the previous page doesn't bleed over.
  const lastSeenPageRef = useRef(initialPage);
  useEffect(() => {
    if (initialPage === lastSeenPageRef.current) return;
    const previous = lastSeenPageRef.current;
    lastSeenPageRef.current = initialPage;
    if (previous !== undefined && initialPage !== undefined) {
      resetOverlayForNewPage();
    }
  }, [initialPage]);

  // Attach to the singleton dispatcher (one DOM listener total) and keep
  // the request context fresh for REQUEST_* handlers.
  useEffect(() => {
    if (missingSetup) return;
    requestContext = { theme, locale, site };
    attachProvider();
    return () => detachProvider();
  }, [missingSetup, theme, locale, site]);

  // Subscribe to the singleton overlay. `useSyncExternalStore` handles SSR
  // by calling the third arg — and since the overlay starts empty on both
  // server and client, hydration matches without special handling.
  const editorOverlay = useSyncExternalStore(subscribeOverlay, getOverlay, getOverlay);

  // Merge seed + overlay. Overlay wins per slotId; missing keys fall through.
  const slotComponents = useMemo(() => {
    const overlaySlots = editorOverlay.slotComponents;
    if (Object.keys(overlaySlots).length === 0) return seedSlotComponents;
    return { ...seedSlotComponents, ...overlaySlots };
  }, [seedSlotComponents, editorOverlay.slotComponents]);

  const slotConfig = editorOverlay.slotConfig ?? seedSlotConfig;
  const metadata = editorOverlay.metadata ?? seedMetadata;

  return {
    missingSetup,
    slotComponents,
    slotConfig,
    metadata,
    isEditorMode,
    highlightedComponentId: editorOverlay.highlightedComponentId,
    highlightedSlotId: editorOverlay.highlightedSlotId,
  };
}

/**
 * Derive the initial `slotComponents` record from either a `CMSPage` (page
 * slots only — layout slots come from the outer provider via hoisting) or a
 * standalone `CMSLayout` (its per-slot components record).
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
