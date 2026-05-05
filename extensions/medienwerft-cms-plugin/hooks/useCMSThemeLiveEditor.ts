import { useEffect, useRef } from 'react';
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
 * Installs a `message` listener that owns a draft `<style>` element
 * appended to `<head>` after the React-managed persisted-theme
 * `<link>`. The bridge mutates this draft element's `textContent` for
 * each editor patch — no React state, no re-render — so preview
 * updates stay sub-frame even with hundreds of variables.
 *
 * Architecture:
 *  - Persisted theme lives in `<link rel="stylesheet">` served by the
 *    `app/[site]/cms-theme.css` route (cacheable, browser-preflighted).
 *  - The draft `<style>` lives only in editor mode and only carries
 *    the editor's transient delta on top of the `<link>`. Source
 *    order in `<head>` (link first, draft after) gives the draft the
 *    cascade win at equal specificity, so editor edits reliably
 *    override published values.
 *
 * Lifecycle:
 *  1. On mount in editor mode, sweep any orphaned **draft** `<style>`
 *     nodes from previous sessions / HMR ({@link sweepDraftStragglers}),
 *     then create a fresh draft `<style>` element with an empty rule.
 *  2. Install the message listener; handle theme-scoped message types
 *     and ignore everything else (component LiveEditor messages share
 *     the same window).
 *  3. On unmount, remove the listener **and** the draft `<style>`.
 *     Unlike the previous architecture this is safe — the persisted
 *     theme lives in the `<link>`, untouched by the bridge.
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

    // Defensive cleanup — kills any draft `<style>` nodes left behind
    // by HMR or a previous editor session. Runs before we create our
    // own so a stale node can't shadow the fresh one.
    sweepDraftStragglers(site);

    // Create the bridge-owned draft element. Appended to <head> after
    // React's hoisted persisted-theme <link>: equal specificity, source
    // order wins, so draft variables override published ones in the
    // cascade.
    const styleNode = document.createElement('style');
    styleNode.setAttribute(THEME_DRAFT_MARKER_ATTR, site);
    styleNode.textContent = `${target} { }`;
    document.head.appendChild(styleNode);

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
          paint(styleNode!, currentTargetRef.current, next);
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
          paint(styleNode!, nextTarget, currentVariablesRef.current);
          break;
        }

        case 'RESET_THEME_VARIABLES': {
          if (data.site && data.site !== site) return;
          // Empty the draft and restore the SSR-resolved target so the
          // <link> values shine through the cascade, exactly as a
          // freshly loaded shopper page would render.
          currentVariablesRef.current = {};
          currentTargetRef.current = initialTargetRef.current;
          paint(styleNode, currentTargetRef.current, currentVariablesRef.current);
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
          const resolved: ThemeTokenManifest = {
            ...base,
            groups: base.groups.map((group) => ({
              ...group,
              tokens: group.tokens.map((token) => {
                const live = readLiveVariable(token.name);
                return live === null ? token : { ...token, currentValue: live };
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
      // The draft <style> is bridge-owned; tearing it down on unmount
      // is safe because the persisted theme lives in the <link>.
      // Removing it on every effect re-run also keeps HMR clean: the
      // next mount's `sweepDraftStragglers` would catch it anyway,
      // but explicit removal avoids a transient duplicate.
      styleNode.remove();
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
