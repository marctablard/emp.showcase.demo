'use client';

import type { ReactNode } from 'react';
import { getStoryblokApi } from '@/lib/storyblok';

const StoryblokProvider = ({ children }: { children: ReactNode }) => {
  getStoryblokApi();

  return children;
};

export { StoryblokProvider };
