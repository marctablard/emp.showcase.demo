'use client';

import type { ReactNode } from 'react';
import { getStoryblokApi } from '@/lib/storyblok';

const StoryblokProvider = ({ children }: { children: ReactNode }) => {
  // Skip Storyblok bridge bootstrap when no access token is configured —
  // the module-level `getStoryblokApi` is a no-op in that case and there
  // is no SDK state to hydrate.
  if (!process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim()) {
    return children;
  }
  getStoryblokApi();

  return children;
};

export { StoryblokProvider };
