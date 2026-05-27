'use client';

import { useEffect } from 'react';
import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';

/**
 * Client-side Visual-Editor bridge — the adapter's `BridgeScript` component.
 *
 * The layout mounts it once (standalone, not as a children wrapper). On
 * mount it bootstraps the Storyblok bridge SDK when an access token is
 * configured, and renders `null` either way so it adds no DOM of its own.
 * Without a token it is a no-op, matching the boot-without-token contract.
 */
export const StoryblokBridgeScript = (): null => {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim();
    if (!token) {
      return;
    }
    storyblokInit({
      accessToken: token,
      use: [apiPlugin],
      bridge: true,
    });
  }, []);

  return null;
};

export default StoryblokBridgeScript;
