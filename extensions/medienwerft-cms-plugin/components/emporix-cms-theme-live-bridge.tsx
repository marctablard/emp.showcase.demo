'use client';

import { useCMSThemeLiveEditor } from '../hooks/useCMSThemeLiveEditor';
import type { ThemeTokenManifest } from '../services/CMSThemeTokenManifestService';

export type EmporixCmsThemeLiveBridgeProps = {
  site: string;
  baseTheme?: string;
  target: string;
  version: 'draft' | 'live' | string;
  /**
   * The persisted theme's variable map, forwarded from SSR. Used by
   * the bridge to answer `REQUEST_THEME` with a meaningful baseline
   * **before** the editor has pushed any draft, since the bridge no
   * longer parses an inline `<style>` text content (the persisted
   * theme lives in a `<link>`'d external CSS file now).
   */
  publishedVariables: Record<string, string>;
  /**
   * Token manifest resolved on the server (see
   * `fetch-cms-theme-token-manifest.ts`). Forwarded to the live editor
   * hook so it can answer `REQUEST_THEME_TOKENS` without an HTTP call.
   * `null` when no `CMSThemeTokenManifestService` is registered — the
   * hook then replies with an empty manifest.
   */
  manifest: ThemeTokenManifest | null;
};

/**
 * Client companion for `EmporixCmsThemeStyle`. Mounts the
 * `useCMSThemeLiveEditor` hook so the editor iframe can live-patch
 * CSS variables via postMessage without reloading.
 *
 * Kept as a thin shell — all logic lives in the hook so it's easy to
 * unit-test the message handling in isolation.
 */
export default function EmporixCmsThemeLiveBridge({
  site,
  baseTheme,
  target,
  version,
  publishedVariables,
  manifest,
}: EmporixCmsThemeLiveBridgeProps) {
  useCMSThemeLiveEditor({
    site,
    baseTheme,
    target,
    version,
    publishedVariables,
    manifest,
  });

  return null;
}
