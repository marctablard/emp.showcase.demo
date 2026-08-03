---
name: platform-jest-server-adapter-imports-react-tree
description: When a server-side CMS adapter imports the shared React render tree, the node-env Platform jest project breaks on pure-ESM next-intl/next-auth; lazy-import + transform fixes
metadata:
  type: feedback
---

The `Platform Tests` jest project runs node-env with ts-jest and (by
default) does NOT transform node_modules. The shared CMS render tree
(`CmsRenderer` → `component-map` → every CMS component) transitively pulls
pure-ESM `next-intl` (via `UiLink` → `@/i18n/navigation`) and `next-auth`
(via `recommendations` → `useCart`). A server-side adapter that imports
that tree at module scope therefore crashes platform tests with
`Unexpected token 'export'` / `Cannot use import statement outside a module`.

**Why:** ADR 0001 (SHOW-323 Slice 6.3 RE-CUT) makes adapters own their
render path — the Mock adapter renders via `CmsRenderer`, and
`StoryblokCmsApi.storyblokInit({ components })` imports the Storyblok
component registry (→ shared components). Both drag the React tree into
platform-tested module graphs.

**How to apply (two complementary levers):**
1. **Lazy-import the heavy tree** at render time:
   `const { CmsRenderer } = await import('@/components/cms/cms-renderer')`
   inside `renderPage`. Keeps the adapter's module graph (DI container,
   webhook paths) free of the React tree AND reduces visitor bundle.
2. **Transform next-intl/use-intl in the Platform project** when an
   eager import is unavoidable (the Storyblok registry must be a static
   import for `storyblokInit`): add a `@swc/jest` JS transform +
   `transformIgnorePatterns: ['/node_modules/(?!(next-intl|use-intl)/)']`
   to the Platform project, mirroring the React Tests project.
3. **Route jsdom React-render tests to the React Tests project** via
   `testMatch` (it carries next-intl/next-auth/product-tile mocks) and
   exclude them from Platform/Component projects' `testPathIgnorePatterns`.
   The RE-CUT routed `*.render-page.test.tsx` + the Storyblok component
   wrappers there.
4. **Lazy-require `@/platform/server` inside server-actions used by client
   components.** A client component (`StoryblokBridgeScript`) that calls a
   server-action (`getStoryblokBridgeConfig`) is imported eagerly by the
   adapter (`StoryblokCmsAdapter.BridgeScript = StoryblokBridgeScript`); if
   the action imports `@/platform/server` at module scope, the adapter
   transitively boots the Inversify container and crashes
   `StoryblokCmsAdapter.test.ts` / `*.contract.test.ts` /
   `cms-webhook-cache.integration.test.ts` (`Reflect.getMetadataKeys`
   TypeError on the side-effect-registered module). Fix:
   `const server = (require('@/platform/server') as ...).default` inside
   the action's helper — jest mocks on `@/platform/server` still apply
   (require resolves through the mock), no behaviour change at runtime.
