'use client';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EmporixCMSContext } from '../context/emporix-cms-context';
import type { CMSPageContextValue } from '../context/emporix-cms-context';
import { useCMSLiveEditor } from '../hooks/useCMSLiveEditor';
import type { CMSLayout, CMSPage, CMSSlotConfig } from '../types';
import CMSSetupMissingDialog from './cms-setup-missing-banner';
import EmporixContentSlot from './emporix-content-slot';

interface EmporixCMSProviderProps {
  /** Page data — used by `EmporixCmsPage`. Mutually exclusive with `initialLayout`. */
  initialPage?: CMSPage;
  /** Layout data — used by `EmporixCmsLayout` when rendering layout slots only. */
  initialLayout?: CMSLayout;
  isEditorMode?: boolean;
  children?: React.ReactNode;
  theme?: string;
}

/**
 * Client component that exposes CMS slot state to child `EmporixContentSlot`s.
 *
 * Providers are composable: when nested inside another `EmporixCMSProvider`
 * (typical when an `EmporixCmsPage` renders inside an outer `EmporixCmsLayout`),
 * this provider **additively merges** its own slots on top of the parent
 * context. Overlapping slot ids are resolved innermost-wins, by convention
 * layout slots (`top`, `bottom`) and page slots (`main`) don't collide.
 *
 * Nested providers also **hoist** any page-bundled layout up to the parent
 * via {@link CMSPageContextValue.hoistLayoutData}. The outer provider owns
 * the state for layout slots it rendered during SSR (typically the published
 * version); after hydration, if the inner page carries an editor-version
 * layout (because `EmporixCmsPage` had access to `searchParams`), it is
 * hoisted up and the outer provider re-derives its slot state from it.
 */
export default function EmporixCMSProvider({
  initialPage,
  initialLayout,
  isEditorMode: serverIsEditorMode,
  children,
  theme,
}: EmporixCMSProviderProps) {
  const parent = useContext(EmporixCMSContext);
  // Layout data lifted in from a nested provider after hydration. Falls back
  // to the server-rendered `initialLayout` while unset.
  const [layout, setLayout] = useState<CMSLayout | undefined>(initialLayout);

  const own = useCMSLiveEditor({
    initialPage,
    initialLayout: layout,
    serverIsEditorMode,
    theme,
  });
  const { missingSetup } = own;

  // Nested provider → forward our page-bundled layout to the nearest parent
  // that accepts hoists. If no parent handles it (we're the root), we keep
  // our own layout state via `hoistLayoutData` below.
  const parentHoist = parent?.hoistLayoutData;
  useEffect(() => {
    if (!initialLayout) return;
    if (parentHoist) {
      parentHoist(initialLayout);
    }
  }, [parentHoist, initialLayout]);

  const hoistLayoutData = useCallback(
    (hoistedLayout: CMSLayout) => {
      if (!hoistedLayout) return;
      // Keep hoists bubbling upward so the outermost provider gets the data.
      if (parentHoist) {
        parentHoist(hoistedLayout);
        return;
      }
      if (!layout || layout.id !== hoistedLayout.id) {
        setLayout(hoistedLayout);
      }
    },
    [parentHoist, layout],
  );

  const contextValue = useMemo<CMSPageContextValue>(() => {
    if (!parent) {
      return {
        slotComponents: own.slotComponents,
        slotConfig: own.slotConfig,
        metadata: own.metadata,
        isEditorMode: own.isEditorMode,
        highlightedComponentId: own.highlightedComponentId,
        highlightedSlotId: own.highlightedSlotId,
        hoistLayoutData,
      };
    }
    // Merge with the parent provider — inner wins for overlapping slot ids.
    const slotComponents = { ...parent.slotComponents, ...own.slotComponents };
    const slotConfig = mergeSlotConfig(parent.slotConfig, own.slotConfig);
    // Pages carry metadata; layouts inherit from the outer page when present.
    const metadata = initialPage ? own.metadata : parent.metadata;
    return {
      slotComponents,
      slotConfig,
      metadata,
      isEditorMode: own.isEditorMode || parent.isEditorMode,
      highlightedComponentId: own.highlightedComponentId ?? parent.highlightedComponentId,
      highlightedSlotId: own.highlightedSlotId ?? parent.highlightedSlotId,
      hoistLayoutData,
    };
  }, [parent, own, initialPage, hoistLayoutData]);

  // When DI isn't wired, short-circuit before producing any context so nested
  // editor-only UIs can surface the "setup missing" banner at the root level.
  if (missingSetup) {
    if (serverIsEditorMode) {
      return <CMSSetupMissingDialog />;
    }
    return <></>;
  }

  // Render components according to structure if Layout was defined
  if (children) {
    return <EmporixCMSContext.Provider value={contextValue}>{children}</EmporixCMSContext.Provider>;
  }

  // Fallback to simply render every slot flat when no children were provided.
  const flatSlotIds = [
    ...new Set([
      ...contextValue.slotConfig.toSorted((a, b) => a.position - b.position).map((s) => s.slotId),
      ...Object.keys(contextValue.slotComponents),
    ]),
  ];

  return (
    <EmporixCMSContext.Provider value={contextValue}>
      {flatSlotIds.map((slotId) => (
        <EmporixContentSlot key={slotId} slot={slotId} />
      ))}
    </EmporixCMSContext.Provider>
  );
}

/**
 * Merge two `slotConfig` lists. Own entries win for overlapping `slotId`s.
 * Position is preserved from the original lists; inner entries are appended
 * after the parent's — consumers sort by `position` when rendering.
 */
function mergeSlotConfig(parent: CMSSlotConfig[], own: CMSSlotConfig[]): CMSSlotConfig[] {
  const ownIds = new Set(own.map((s) => s.slotId));
  return [...parent.filter((s) => !ownIds.has(s.slotId)), ...own];
}
