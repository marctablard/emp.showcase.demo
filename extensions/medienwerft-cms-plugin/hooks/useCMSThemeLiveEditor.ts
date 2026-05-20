import { useEffect, useRef } from 'react';
import { cmsThemeCssUrl } from '../lib/build-theme-css';
import { THEME_DRAFT_MARKER_ATTR } from '../lib/theme-style-constants';
import type { ThemeTokenManifest } from '../services/CMSThemeTokenManifestService';
import type { CMSEditorMessage } from '../types';

export interface UseCMSThemeLiveEditorOptions {
  site: string;
  baseTheme?: string;
  target: string;
  version: 'draft' | 'live' | string;
  /**
   * The persisted theme's variable map, resolved during SSR and
   * passed down through the bridge component. The hook does **not**
   * write these to its draft `<style>` (the persisted `<link>`
   * already provides them in the cascade); they only seed
   * `THEME_RESPONSE.variables` so an editor that never pushes a draft
   * still sees a meaningful answer.
   */
  publishedVariables: Record<string, string>;
  /**
   * Token manifest resolved during SSR. Forwarded to the editor when
   * it sends `REQUEST_THEME_TOKENS`. `null` means the host has not
   * registered a `CMSThemeTokenManifestService` — the hook then replies
   * with a synthetic empty manifest so the editor still gets a typed
   * response (and can fall back to its generic UI).
   */
  manifest?: ThemeTokenManifest | null;
}

/**
 * Mirrors the service-side guard so the editor can't bypass validation
 * by going through postMessage instead of persistence. Matches the
 * schema contract advertised to the editor team.
 */
const VALID_VARIABLE_NAME = /^--[a-z0-9][a-z0-9-_]*$/i;
const VALID_VARIABLE_VALUE = /^[^;<>]+$/;
const DISALLOWED_VALUE_TOKENS = /url\s*\(|expression\s*\(|javascript\s*:/i;

/**
 * Installs a `message` listener that lazily owns a draft `<style>`
 * element appended to `<head>` after the persisted-theme `<link>`.
 * The bridge mutates the draft's `textContent` per editor patch — no
 * React state, no re-render — so preview updates stay sub-frame.
 *
 * The iframe hosts several editor views (Page, Layout, Theme); only
 * the Theme view sends `UPDATE_THEME_VARIABLES` / `UPDATE_THEME_TARGET`.
 * The draft `<style>` is created lazily on the first such message and
 * torn down on `RESET_THEME_VARIABLES`, so Page/Layout sessions render
 * with no inline overlay CSS — identical to a shopper cascade.
 *
 * The mount also rewrites the `<link>` href to a cache-bypassed `?v=`
 * so iframe navigations always pick up the latest publish. See
 * {@link swapLinkToLivePreview}.
 */
export function useCMSThemeLiveEditor({
  site,
  baseTheme,
  target,
  version,
  publishedVariables,
  manifest,
}: UseCMSThemeLiveEditorOptions) {
  // Track the editor's draft delta. Empty by default — the persisted
  // theme is provided by the `<link>` in the cascade, so an empty
  // draft means "no overrides, show the published theme".
  const currentVariablesRef = useRef<Record<string, string>>({});
  // The published baseline reported back to the editor on
  // `REQUEST_THEME` until any draft is pushed. Updated whenever a
  // re-render brings a new published map (e.g. after a publish event
  // bumped the SSR-resolved variables) without resetting the draft.
  const publishedVariablesRef = useRef<Record<string, string>>(publishedVariables);
  publishedVariablesRef.current = publishedVariables;
  // Mutable target selector. Seeded from the SSR-resolved prop so the
  // first paint matches what the server emitted, then mutated by
  // `UPDATE_THEME_TARGET` messages without an iframe reload. Held in a
  // ref so neither the listener identity nor the parent re-render
  // cycle interferes with target swaps. The same ref also captures the
  // initial selector so `RESET_THEME_VARIABLES` can restore it.
  const initialTargetRef = useRef<string>(target);
  const currentTargetRef = useRef<string>(target);
  // Keep the manifest in a ref so the message handler always sees the
  // freshest version even if the parent re-renders with new props —
  // the listener itself is installed once and would otherwise close
  // over a stale value.
  const manifestRef = useRef<ThemeTokenManifest | null>(manifest ?? null);
  manifestRef.current = manifest ?? null;

  useEffect(() => {
    // Only install the listener inside the CMS editor iframe. The
    // bridge renders unconditionally from the layout (which can't see
    // `searchParams`), so we self-detect here — any storefront tab
    // that happens to have `?editMode=true` **and** is embedded in a
    // parent frame is treated as an editor preview.
    if (typeof window === 'undefined') return;
    const isFramed = window.parent !== window;
    const search = new URLSearchParams(window.location.search);
    const isEditorMode = isFramed && search.get('editMode') === 'true';
    if (!isEditorMode) return;

    // Kill any draft `<style>` left behind by HMR or a previous Theme
    // editor session so a Page/Layout session doesn't inherit it.
    sweepDraftStragglers(site);

    // Rewrite the SSR `<link>` to a cache-bypassed `?v=` so iframe
    // navigations pick up the latest publish. No host opt-in needed.
    swapLinkToLivePreview(site);

    // Draft `<style>` is created on the first theme-mutation message
    // and removed on `RESET_THEME_VARIABLES`. Page/Layout sessions
    // therefore render with no inline overlay CSS.
    let styleNode: HTMLStyleElement | null = null;

    function ensureStyleNode(): HTMLStyleElement {
      if (styleNode) return styleNode;
      const node = document.createElement('style');
      node.setAttribute(THEME_DRAFT_MARKER_ATTR, site);
      node.textContent = `${currentTargetRef.current} { }`;
      document.head.appendChild(node);
      styleNode = node;
      return node;
    }

    function removeStyleNode(): void {
      if (!styleNode) return;
      styleNode.remove();
      styleNode = null;
    }

    // Empty draft — published values come from the <link> in the
    // cascade. `initialTargetRef` is the SSR-resolved selector; the
    // RESET handler restores draft + target to this baseline.
    currentVariablesRef.current = {};
    initialTargetRef.current = target;
    currentTargetRef.current = target;

    function handleMessage(event: MessageEvent) {
      const data = event.data as CMSEditorMessage | undefined;
      if (!data?.type) return;

      switch (data.type) {
        case 'REQUEST_THEME': {
          const { requestId } = data;
          // Report the published baseline merged with any active draft
          // so the editor sees the full effective state — same shape
          // as before the <link> split, even though the published
          // values now physically live in the cascade rather than in
          // a node we own. Draft entries take precedence on key
          // collision (intentional: the editor is asking what the
          // user is currently seeing, drafts included).
          const variables = {
            ...publishedVariablesRef.current,
            ...currentVariablesRef.current,
          };
          event.source?.postMessage(
            {
              type: 'THEME_RESPONSE',
              site,
              baseTheme,
              target: currentTargetRef.current,
              variables,
              version,
              ...(requestId && { requestId }),
            },
            { targetOrigin: '*' },
          );
          break;
        }

        case 'UPDATE_THEME_VARIABLES': {
          if (data.site && data.site !== site) return;
          let next: Record<string, string>;
          if (data.mode === 'replace') {
            next = sanitizeIncomingVariables(data.variables);
          } else {
            next = { ...currentVariablesRef.current };
            for (const [rawName, rawValue] of Object.entries(data.variables ?? {})) {
              const name = typeof rawName === 'string' ? rawName.trim() : '';
              if (!name || !VALID_VARIABLE_NAME.test(name)) continue;
              const value = typeof rawValue === 'string' ? rawValue.trim() : '';
              if (value === '') {
                delete next[name];
                continue;
              }
              if (!VALID_VARIABLE_VALUE.test(value)) continue;
              if (DISALLOWED_VALUE_TOKENS.test(value)) continue;
              next[name] = value;
            }
          }
          currentVariablesRef.current = next;
          // No-op when there's nothing to apply and no existing draft
          // — a stray empty payload shouldn't materialise the `<style>`.
          if (Object.keys(next).length === 0 && !styleNode) break;
          paint(ensureStyleNode(), currentTargetRef.current, next);
          break;
        }

        case 'UPDATE_THEME_TARGET': {
          // Strict site check — retargeting the wrong preview is more
          // destructive than a stray variable patch, so unlike
          // `UPDATE_THEME_VARIABLES` we require an explicit match.
          if (typeof data.site !== 'string' || data.site !== site) return;
          const nextTarget = computeTarget(data.site, data.base_theme);
          if (nextTarget === currentTargetRef.current) return; // idempotent no-op
          currentTargetRef.current = nextTarget;
          // Retarget alone shouldn't materialise the `<style>` —
          // repaint only if a draft already exists.
          if (styleNode) paint(styleNode, nextTarget, currentVariablesRef.current);
          break;
        }

        case 'RESET_THEME_VARIABLES': {
          if (data.site && data.site !== site) return;
          // Drop the draft entirely so the DOM matches a shopper render.
          currentVariablesRef.current = {};
          currentTargetRef.current = initialTargetRef.current;
          removeStyleNode();
          break;
        }

        case 'REQUEST_THEME_TOKENS': {
          const { requestId } = data;
          const base: ThemeTokenManifest = manifestRef.current ?? {
            site,
            baseTheme,
            fallback: true,
            groups: [],
          };
          // Read the "default" (no-override) values for every token by
          // briefly silencing both override sources — the persisted
          // theme `<link>` and the bridge's draft `<style>` — and
          // querying `getComputedStyle`. The dynamic read is what the
          // user is actually seeing without their CMS customisations,
          // which is the right baseline for the editor's "reset"
          // affordance and beats whatever the manifest had hardcoded
          // (which can drift from the active theme's static CSS, e.g.
          // a Tailwind-default manifest for a custom .theme-medienwerft).
          const defaults = readNoOverrideValues(base, styleNode, site);
          const resolved: ThemeTokenManifest = {
            ...base,
            groups: base.groups.map((group) => ({
              ...group,
              tokens: group.tokens.map((token) => {
                const live = readLiveVariable(token.name);
                const dynamicDefault = defaults[token.name];
                return {
                  ...token,
                  ...(dynamicDefault !== undefined && { defaultValue: dynamicDefault }),
                  ...(live !== null && { currentValue: live }),
                };
              }),
            })),
          };
          event.source?.postMessage(
            {
              type: 'THEME_TOKENS_RESPONSE',
              site,
              manifest: resolved,
              ...(requestId && { requestId }),
            },
            { targetOrigin: '*' },
          );
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      // No-op when no draft was ever created (Page/Layout sessions).
      removeStyleNode();
    };
    // `target` / `baseTheme` / `publishedVariables` are intentionally
    // **not** in the dep array: the listener owns them via refs after
    // mount, and re-running the effect on every parent re-render
    // would tear down the draft <style> mid-edit. Refs above keep the
    // latest values reachable from inside the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, version]);
}

/**
 * Resolve the CSS selector the override `<style>` should be scoped to.
 * Mirrors the SSR-side resolution in `emporix-cms-theme-style.tsx` so
 * the live bridge produces the same selector for the same inputs —
 * editing the base-theme input with no value reverts the preview to
 * `body[data-cms-site="<site>"]` exactly as the server would render.
 *
 * Treats `null` / `undefined` / empty / whitespace-only `baseTheme`
 * uniformly: all four mean "no base theme". The leading dot is added
 * here so the wire payload (`base_theme: 'theme-medienwerft'`) stays
 * symmetrical with the persisted attribute.
 */
function computeTarget(site: string, baseTheme: string | null | undefined): string {
  const trimmed = (baseTheme ?? '').trim();
  return trimmed ? `.${trimmed}` : `body[data-cms-site="${site}"]`;
}

/**
 * Idempotent re-render of the bridge-owned draft `<style>`.
 *
 * Computes the rule text once and only writes when it differs from the
 * current `textContent`. The skip is important because the editor
 * re-pushes `UPDATE_THEME_TARGET` + `UPDATE_THEME_VARIABLES (replace)`
 * after every `IFRAME_READY` handshake — without the equality check
 * each handshake would force a redundant style-recalc on the whole
 * page.
 */
function paint(node: HTMLStyleElement, target: string, variables: Record<string, string>): void {
  const entries = Object.entries(variables);
  const next =
    entries.length === 0 ? `${target} { }` : `${target} { ${entries.map(([k, v]) => `${k}: ${v};`).join(' ')} }`;
  if (node.textContent !== next) node.textContent = next;
}

/**
 * Remove any orphaned **draft** `<style>` nodes from `<head>`. Runs
 * once per mount, before the bridge creates its own draft element.
 *
 * Stragglers can survive in two scenarios:
 *  - Next.js HMR replaces the cms-plugin module graph but the
 *    previous bridge instance's effect cleanup didn't run (e.g. error
 *    during teardown). Its draft `<style>` is left behind in `<head>`.
 *  - A previous editor session in the same tab navigated to a
 *    different site code; the matching-attribute draft for the old
 *    site stays unless we sweep it.
 *
 * Identifies drafts by the {@link THEME_DRAFT_MARKER_ATTR} attribute
 * the bridge stamps on creation — deliberately distinct from React's
 * `data-href` on the persisted `<link>` so the sweep can never delete
 * the persisted-theme element.
 */
function sweepDraftStragglers(_site: string): void {
  if (typeof document === 'undefined') return;
  const all = document.querySelectorAll<HTMLStyleElement>(`style[${THEME_DRAFT_MARKER_ATTR}]`);
  // Remove **all** existing drafts. The bridge always creates a fresh
  // one immediately after, so leaving "first match for current site"
  // would just preserve a stale draft whose contents lag the editor.
  all.forEach((node) => node.remove());
}

/**
 * Pick `?v=<mode>` for the bridge link swap from the iframe page URL.
 * Layouts can't see `searchParams`, so the URL is the only signal an
 * editor view can pass to a layout-mounted bridge.
 *
 *  - `cmsThemeVersion=draft` → request the draft row (API falls back
 *    to live-preview when no draft exists).
 *  - else → `live-preview` (cache-bypassed live read).
 */
function determinePreviewVersion(): 'draft' | 'live-preview' {
  if (typeof window === 'undefined') return 'live-preview';
  const search = new URLSearchParams(window.location.search);
  if (search.get('cmsThemeVersion') === 'draft') return 'draft';
  return 'live-preview';
}

/**
 * Rewrite the SSR `<link>` href to a cache-bypassed `?v=<mode>`. SSR
 * emits a content-hashed `immutable` URL (CDN-friendly for shoppers,
 * wrong for editor previews where a publish must land on the next
 * navigation). The `?v=live-preview` / `?v=draft` responses carry
 * `Cache-Control: private, no-store`.
 *
 * The `<link>` is matched by href pattern, not by a `data-*` attribute
 * — React 19 doesn't reliably preserve custom data attributes on
 * hoisted stylesheet resources. Idempotent; bails if the link hasn't
 * been hoisted yet (next mount retries).
 */
/**
 * Locate the persisted-theme `<link>` for the given site. Matched by
 * href pattern (`/<site>/cms-theme.css`) rather than `data-*` attribute
 * because React 19's stylesheet resource hoisting strips custom data
 * attributes from hoisted `<link>` nodes.
 */
function findCmsThemeLink(site: string): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  const sitePath = `/${encodeURIComponent(site)}/cms-theme.css`;
  const altSitePath = `/${site}/cms-theme.css`;
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  for (const candidate of Array.from(links)) {
    const href = candidate.getAttribute('href') ?? '';
    if (href.includes(sitePath) || href.includes(altSitePath)) return candidate;
  }
  return null;
}

function swapLinkToLivePreview(site: string): void {
  const link = findCmsThemeLink(site);
  if (!link) return;

  const targetHref = cmsThemeCssUrl(site, determinePreviewVersion());
  if (link.getAttribute('href') === targetHref) return;
  link.setAttribute('href', targetHref);
}

/**
 * Read the live computed value of a CSS custom property from the
 * storefront DOM.
 *
 * Reads from `document.body` rather than `document.documentElement` so
 * theme-class overrides scoped to `.theme-<name>` (which the layout
 * stamps onto `<body>`) are reflected — `<body>` inherits all `:root`
 * declarations on top, so this works for both Tailwind v4 `@theme`
 * tokens (declared on `:root`) and project-specific theme tokens.
 *
 * Returns the substituted value as the browser resolves it (so
 * `var()` chains are followed) but does **not** force conversion to a
 * canonical form — `oklch(...)` strings stay as `oklch(...)`. That's
 * fine for round-tripping into a CSS declaration; if the editor needs
 * a normalized RGB string for a colour picker it should set the value
 * on a probe element's actual property and read the computed style of
 * that property.
 *
 * Returns `null` when the variable is not present in the cascade or
 * the call is not running in a browser, so callers can leave
 * `currentValue` undefined rather than emitting an empty string.
 */
function readLiveVariable(name: string): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  const target = document.body ?? document.documentElement;
  if (!target) return null;
  const value = getComputedStyle(target).getPropertyValue(name).trim();
  return value.length ? value : null;
}

/**
 * Read every manifest token's value as it would resolve **without**
 * any CMS-theme overrides — i.e. from the static CSS cascade only
 * (`brand.css` → `alias.css` → `themes/<theme>.css`).
 *
 * Synchronously toggle the two override sources off (the persisted-
 * theme `<link>` located via {@link findCmsThemeLink}, and the bridge's
 * own draft `<style>`), snapshot `getComputedStyle` for each token,
 * then restore. The `try/finally` guarantees we re-enable the sources
 * even if a read throws.
 */
function readNoOverrideValues(
  manifest: ThemeTokenManifest,
  draftNode: HTMLStyleElement | null,
  site: string,
): Record<string, string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {};

  const link = findCmsThemeLink(site);
  const draftSheet = draftNode?.sheet ?? null;

  const linkWasDisabled = link?.disabled ?? false;
  const draftWasDisabled = draftSheet?.disabled ?? false;

  if (link) link.disabled = true;
  if (draftSheet) draftSheet.disabled = true;

  try {
    const out: Record<string, string> = {};
    for (const group of manifest.groups) {
      for (const token of group.tokens) {
        const value = readLiveVariable(token.name);
        if (value !== null) out[token.name] = value;
      }
    }
    return out;
  } finally {
    if (link) link.disabled = linkWasDisabled;
    if (draftSheet) draftSheet.disabled = draftWasDisabled;
  }
}

/**
 * Drop invalid entries — mirrors the server-side sanitizer. Keeps the
 * editor's transient state from diverging from what would actually be
 * persisted.
 */
function sanitizeIncomingVariables(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input ?? {})) {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!name || !value) continue;
    if (!VALID_VARIABLE_NAME.test(name)) continue;
    if (!VALID_VARIABLE_VALUE.test(value) || DISALLOWED_VALUE_TOKENS.test(value)) continue;
    out[name] = value;
  }
  return out;
}
