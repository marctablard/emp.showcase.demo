'use client';

import { createContext, useContext } from 'react';
import type { CMSComponent } from '@/platform/services/model/cms';
import type { CMSLayout, CMSSlotConfig } from '../types';

export interface CMSPageContextValue {
  slotComponents: Record<string, CMSComponent[]>;
  slotConfig: CMSSlotConfig[];
  metadata: {
    title: string;
    description: string;
    slug: string;
    url: string;
  };
  isEditorMode: boolean;
  highlightedComponentId: string | null;
  highlightedSlotId: string | null;
  /**
   * Allows a nested `EmporixCMSProvider` to hand up the layout it received
   * bundled with its page response. Typical flow: an outer `EmporixCmsLayout`
   * SSR-renders the published layout; the inner `EmporixCmsPage`, which has
   * access to `searchParams` and can therefore fetch editor-version data,
   * hoists its `page.layout` up after hydration so the outer provider re-
   * renders layout slots with the editor-aware version. Layout slot consumers
   * (e.g. `<EmporixContentSlot slot="top" />`) live outside the inner
   * provider and thus only see the outer's context — without this hoist they
   * would be stuck on whatever the outer was SSR-seeded with.
   *
   * Only the root provider implements this; nested providers inherit the
   * parent's callback unchanged so hoists propagate to the top.
   */
  hoistLayoutData?: (layout: CMSLayout) => void;
}

export const EmporixCMSContext = createContext<CMSPageContextValue | null>(null);

export function useEmporixCMSContext() {
  const context = useContext(EmporixCMSContext);
  if (!context) {
    throw new Error('useEmporixCMSContext must be used within a EmporixCMSProvider');
  }
  return context;
}
