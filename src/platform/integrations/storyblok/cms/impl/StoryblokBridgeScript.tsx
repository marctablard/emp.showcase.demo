'use client';

import { useEffect } from 'react';
import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';
import { getStoryblokBridgeConfig } from '@/app/_actions/storyblok-bridge';

/**
 * Client-side Visual-Editor bridge — the adapter's `BridgeScript` component.
 *
 * The layout mounts it once (standalone, not as a children wrapper). On
 * mount it asks the server action for the bridge config; when the action
 * resolves a config object it bootstraps the Storyblok bridge SDK. The
 * access token is never read from the browser bundle — it only ever crosses
 * the wire as the resolved payload of an authorised server-action call.
 *
 * Failure modes are silent on purpose: a missing config (null) or a
 * rejected action both leave the bridge uninitialised, but the rest of the
 * page still renders.
 */
export const StoryblokBridgeScript = (): null => {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const config = await getStoryblokBridgeConfig();
        if (cancelled || !config) {
          return;
        }
        storyblokInit({
          accessToken: config.accessToken,
          use: [apiPlugin],
          bridge: true,
        });
      } catch {
        // Server-action rejected — fail safe: bridge stays uninitialised,
        // the page keeps rendering.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default StoryblokBridgeScript;
