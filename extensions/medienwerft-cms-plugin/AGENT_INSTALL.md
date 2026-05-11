# Agent Install Guide — Emporix CMS Plugin

Constraints and decision rules for an **automated agent** installing
this extension into an existing storefront repo. [`INSTALLATION.md`](./INSTALLATION.md)
is the source of truth for *what* to do; this file covers *how* to do
it safely without making the kind of mistakes humans catch
intuitively.

> Read this file in full **before** running any tool calls. Every rule
> below exists because a previous install got it wrong.

---

## Hard Rules

1. **Never overwrite an existing file.** Every target listed in
   INSTALLATION.md may already exist in the host repo (`globals.css`,
   `next.config.ts`, `.env`, `[locale]/layout.tsx`, etc.).
   Always read first, then merge. If a merge is non-trivial
   (existing custom logic), surface a diff to the user before
   writing.
2. **Use generic naming for example code.** When creating component
   types, decorators, or theme tokens, use prefixes from this list:
   `cms-`, `custom-`, `my-`. **Do not** copy names from any reference
   implementation found in the repo (e.g. `mw-header`, `--mw-orange`,
   `medienwerftComponents`). Those are this storefront's specifics and
   will pollute someone else's codebase.
3. **Don't invent component definitions.** The agent's job is to wire
   up the extension, **not** to author a component catalogue. Create
   `StorefrontCMSComponentService` with an **empty** `definitionMap`
   and leave a TODO comment pointing the developer at
   [INSTALLATION.md §Component Setup](./INSTALLATION.md#component-setup).
4. **Don't add dependencies.** The extension uses the storefront's
   existing dependencies. If you find yourself reaching for
   `npm install`, stop and ask.
5. **Skip the API key in development.** `NEXT_PUBLIC_CMS_EDITOR_API_KEY`
   is **optional**. Leave it out unless the user explicitly says they
   want production-style auth.
6. **Run `npm run generate` after every DI-affecting change** —
   creating a new injectable, changing the extension's contents,
   restoring it from a fresh checkout. Verify the command exits 0
   before proceeding.

---

## Pre-flight (do this first, in one batch)

Run these read-only checks in parallel before any edits, so you know
what state the host repo is in:

- `extensions/medienwerft-cms-plugin/plugin.json` exists → extension is present.
- `package.json` contains a `generate` script.
- `src/app/globals.css` — does it already `@source "../../extensions"`?
- `next.config.ts` (or `.js`/`.mjs`) — does it already export
  `headers()`? Note which file extension the host uses.
- `.env` (and `.env.template`) — which of the env vars are
  already set? (See [INSTALLATION.md §6](./INSTALLATION.md#6-configure-environment-variables).)
  Pay particular attention to `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT`
  — without it, live-editing will silently break.
- `src/app/[site]/[locale]/layout.tsx` — does the `<body>` already
  carry `data-cms-site`? Does it already render `EmporixCmsThemeStyle`?
- `src/app/[site]/cms-theme.css/route.ts` — exists?
- `src/app/api/cms/categories/tree/route.ts` — exists? (the editor's
  category picker silently shows nothing if missing)
- Any pre-existing `src/app/api/categories/...` route in the host —
  note its shape; the plugin's namespace is `/api/cms/...` to avoid
  collisions, but if there's an existing host route serving the same
  data the operator may want to consolidate.
- `src/platform/services/cms/impl/` — is there already a class
  decorated with `@injectable('EmporixCMSComponentService', ...)`?
- Any route group under `src/app/[site]/[locale]/` (e.g. `(default)`,
  `(reduced)`) that has its own `layout.tsx` — these may need
  `EmporixCmsLayout` wrapping.

Report a short summary of what's already in place and what's missing
to the user before touching anything.

---

## Step-by-Step Decision Rules

For each numbered step in [INSTALLATION.md §Installation](./INSTALLATION.md#installation),
follow the matching rule below. Execute steps in order; **don't
parallelize** edits across steps because later steps assume earlier
ones succeeded.

### Step 2 — Tailwind `@source`

- If `src/app/globals.css` already contains
  `@source "../../extensions"` → skip.
- Else append the directive **after** the existing `@import 'tailwindcss';`
  line, preserving everything else.

### Step 4 — DI generation

- **Before running**, ensure
  `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true` is present in
  `.env`. If not, complete Step 6 first, then come back. The
  generator reads this var to decide whether to emit the client-side
  DI bundle the live editor depends on.
- Run `npm run generate`. If it exits non-zero, stop and surface
  the error. Do **not** edit generated DI files by hand to make the
  build pass.
- Re-run this step any time `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT`
  changes value, or after Configuration §1 creates a new injectable.

### Step 5 — Theme stylesheet route handler

- Path: `src/app/[site]/cms-theme.css/route.ts` (the folder name
  literally contains the dot — do **not** rename it).
- Body must be exactly the one-line re-export shown in INSTALLATION.md.
- If the file exists, read it and verify it re-exports
  `cmsThemeCssGET as GET`. Don't replace.

### Step 6 — Environment variables

- Read `.env` first. **Append** missing keys; **do not** edit
  existing values, even placeholder ones — leave that to the user.
- If `.env` does not exist, create it with the keys from
  [INSTALLATION.md §6](./INSTALLATION.md#6-configure-environment-variables).
  Use `your-…-here` placeholders for secrets, not real values.
- `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true` is the one key you
  **should** write as a literal value (not a placeholder) — it's a
  feature flag, not a secret, and live-editing is broken without it.
- Also append the same keys to `.env.template` if that file exists.
- After editing env vars that affect DI (`NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT`),
  go back and re-run Step 4.

### Step 7 — Category Tree route handler

- Path: `src/app/api/cms/categories/tree/route.ts` — note the
  `/api/cms/...` namespace, not `/api/categories/...`. The CMS prefix
  is intentional: it keeps the plugin's editor-only endpoint from
  colliding with any host-owned `/api/categories/*` surface that
  serves shopper navigation.
- Body must be exactly the one-line re-export shown in
  [INSTALLATION.md §7](./INSTALLATION.md#7-mount-the-category-tree-route).
- If the file exists, read it and verify it re-exports
  `categoryTreeGET as GET`. Don't replace.
- If the host already has a route at `src/app/api/categories/tree`
  with a different purpose (shopper-facing tree, search facet feed,
  etc.), do **not** delete or rename it. Mount the plugin's route at
  the `/api/cms/...` path next to it; the two coexist by design.

### Configuration §1 — Service Interface Implementation

- Path: `src/platform/services/cms/impl/StorefrontCMSComponentService.ts`.
- If a file already exports a class decorated with
  `@injectable('EmporixCMSComponentService', ...)`, **stop and ask**
  before modifying. The host probably has a real catalogue you'd
  destroy.
- If creating fresh, write the minimal shell with an empty
  `definitionMap`:

  ```typescript
  import { AbstractCMSComponentService } from '@extensions/medienwerft-cms-plugin/services/impl/AbstractCMSComponentService';
  import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';
  import { injectable } from '@/platform/core/di/injectable';

  // TODO: register CMS component definitions here.
  // See extensions/medienwerft-cms-plugin/INSTALLATION.md#component-setup
  const definitionMap: Record<string, CMSComponentEntry> = {};

  @injectable('EmporixCMSComponentService', 'Singleton')
  export class StorefrontCMSComponentService extends AbstractCMSComponentService {
    constructor() {
      super(definitionMap);
    }
  }

  export default StorefrontCMSComponentService;
  ```

- Do **not** create a `StorefrontCMSComponentDecoratorService` unless
  the user has asked for one. Decorators are an optional concern.
- Re-run `npm run generate` after creating the file.

#### Client components in the registry

The `definitionMap` is read from a server module at DI-bootstrap time.
If a component needs `'use client'` (state, refs, form handlers,
lightbox), do **not** put the `CMSComponentEntry` constant in the
same file — Next.js replaces named exports of a `'use client'` module
with client-reference proxies, and the DI container will crash at
instrumentation with `Cannot read properties of undefined (reading 'type')`.

Split into two files:

- `my-component-client.tsx` — `'use client'`, exports the React
  component as default.
- `my-component.tsx` — server module, imports the component via
  `dynamic(() => import('./my-component-client'))`, exports the
  `myComponentEntry: CMSComponentEntry` constant.

### Configuration §2 — Token Manifest

The plugin ships a default `CMSThemeTokenManifestService` aliased to
`TailwindCMSThemeTokenManifestService`, which exposes the Emporix
Tailwind token set (`--color-primary-500`, `--color-text-*`, the
`--spacing-*` scale, etc.). That list **is the editor's UI** — every
variable named in the manifest gets a row in the ThemeEditor; every
variable not listed is invisible to the editor regardless of what
exists in the CSS cascade.

What's decided at install time is therefore **which variables to
expose**, not what their default values are. Defaults are read live
from the cascade by the bridge (`REQUEST_THEME_TOKENS`), so the
storefront's actual CSS dictates them — there's no hardcoded mirror
to maintain or override.

**When the default Tailwind manifest is fine:**
- Storefront uses the reference Emporix Tailwind cascade
  (`brand.css` → `alias.css` → `mapped.css`) without renaming tokens.
- Operator audience expects the standard Emporix token vocabulary.

**When to register a custom manifest:**
- Storefront uses non-standard token names (e.g. brand-prefixed
  palette like `--mw-orange`, design-system swatches that don't map
  to Tailwind's semantic alias layer).
- Operator audience should see a curated subset (e.g. only the four
  brand-critical colors, hide spacing/radius scales).
- Storefront wants to add tokens the Tailwind list omits (custom
  shadows, gradient stops, motion durations).

If you can't tell from the host's CSS, **stop and ask** — the
manifest is a UX decision, not a mechanical install one.

#### Authoring a custom manifest

- Path convention: `src/platform/services/cms/impl/<Name>CMSThemeTokenManifestService.ts`.
  See [`StorefrontCMSThemeTokenManifestService.ts`](../../src/platform/services/cms/impl/StorefrontCMSThemeTokenManifestService.ts)
  in this repo for a worked example.
- Decorate with `@injectable('<Name>CMSThemeTokenManifestService', 'Singleton')`
  so DI can find it.
- Implement `getManifest(site): Promise<ThemeTokenManifest | null>`.
  Return one or more `ThemeTokenGroup`s with curated `ThemeToken`
  entries (`name`, `label`, `type`, optional `description`,
  `aliasOf`, `advanced`). **Do not** set `defaultValue` — leave it
  off and let the bridge fill it in dynamically.
- Re-run `npm run generate` after creating the file.

#### Activating a custom manifest

The plugin's `plugin.json` currently aliases
`CMSThemeTokenManifestService → TailwindCMSThemeTokenManifestService`,
and **extension aliases win over `depency.yml`** (per the DI
generator's merge order). Two ways to swap in a host service:

1. **Edit [`plugin.json`](./plugin.json)** — change the alias target
   to the host service's class name. This is the only mechanism that
   keeps a single source of truth for the binding. Note that this
   modifies the plugin file, so re-applying plugin updates needs
   awareness of the local change.
2. **Remove the alias from `plugin.json`** and add it to the host's
   [`src/platform/depency.yml`](../../src/platform/depency.yml) under
   `Services:`. Cleaner separation (plugin stays untouched), but
   requires editing two files instead of one.

After either, re-run `npm run generate` and confirm the generated
`src/platform/{client,ssr,server}.ts` show the alias pointing at the
host service.

### Page Integration — Layouts & Pages

- **Root layout** (`src/app/[site]/[locale]/layout.tsx`):
  - Add `data-cms-site={siteCode}` to `<body>` if absent.
  - Add the `EmporixCmsThemeStyle` import and JSX line if absent.
  - Preserve all existing children, providers, fonts, and class names.
- **Route-group layouts** (`(default)`, `(reduced)`, `(no-margin)`,
  etc.):
  - **Do not** wrap an existing layout in `EmporixCmsLayout`
    unilaterally. Ask the user which route groups should be CMS-driven
    and what `layoutId` each one uses.
- **Pages** (`page.tsx`):
  - Don't convert existing routes to `EmporixCmsPage` on your own.
    Ask the user which routes should be CMS-driven.
  - Once authorized, pick the pattern by what the user wants the
    route file to control:
    - **One slug per route file** (home, about, contact) →
      predefined-slug pattern
      ([INSTALLATION.md §Page Integration §1](./INSTALLATION.md#1-predefined-slug-pages)).
      Hardcode the slug in JSX (`slug="home"`).
    - **Many URLs under one folder** (CMS owns whole sections) →
      catch-all dynamic route
      ([INSTALLATION.md §Page Integration §2](./INSTALLATION.md#2-catch-all-dynamic-routes)).
      File path **must** use `[...slug]/page.tsx` — triple-dot
      catch-all, not `[slug]/page.tsx` (the single-segment form
      only matches one path component and silently 404s on nested
      URLs like `/legal/imprint`).
  - **Always forward `searchParams`** to `EmporixCmsPage`
    (`searchParams={searchParamsData}`). Without it the live-editor
    handshake silently no-ops — postMessage updates land but never
    apply. Forgetting this is the #1 install bug. The destination
    page must accept a `searchParams` prop and `await` it (it's a
    `Promise` in App Router).
  - Don't introduce a `[...slug]/page.tsx` next to existing same-folder
    routes without surfacing the conflict. The catch-all coexists with
    a literal `page.tsx` (Next prefers static), but conflicts with any
    sibling `[id]/page.tsx` — pick one.
  - The `theme` prop is **optional**. Only pass it when the host's
    `StorefrontCMSComponentService` scopes definitions per theme. If
    you can't tell from reading the host's component service, leave it
    out — it's one prop to add later.
  - `setRequestSite` / `setRequestLocale` are host routing helpers,
    not CMS plugin requirements. Add them only if other route files
    in the same project already call them; otherwise they're noise.
  - In the catch-all pattern, the discriminator returned by
    `fetchCMSPage` is `'notfound' in data` (all lowercase, matching
    the `CMSNoResult` type). Don't write `'notFound'` — that branch
    never fires.

### Cross-Origin Configuration — `next.config.ts`

- If the file already has a `headers()` callback, **merge** the new
  header objects into the existing array; don't replace the
  callback.
- If the file is JavaScript (`next.config.js` / `.mjs`), translate the
  TypeScript example accordingly.
- Use the env-var-driven origin list (`CMS_EDITOR_ORIGINS`) — never
  hard-code a domain.

---

## Verification Checklist

After all steps, verify in this order. Stop at the first failure and
diagnose before continuing:

1. `npm run generate` exits 0.
2. `npx tsc --noEmit` (or the project's typecheck script) passes.
   Type errors here usually mean a mis-pathed import.
3. `npm run dev` starts cleanly. The dev banner from
   [`cms-setup-missing-banner.tsx`](./components/cms-setup-missing-banner.tsx)
   should **not** appear — if it does, the
   `EmporixCMSComponentService` binding is missing or mis-named.
4. Loading any storefront page in a browser does not 404 on
   `/<site>/cms-theme.css` (check the Network tab). A 404 means
   Step 5 was skipped or the folder name is wrong.
5. Opening the CMS editor and triggering its category-picker UI
   (e.g. add an `mw-header`-style nav item, click "select category")
   does not 404 on `/api/cms/categories/tree?site=...`. A 404 means
   Step 7 was skipped or the folder path is wrong.
6. The page renders without React hydration warnings about mismatched
   `<body>` attributes — those usually mean the `data-cms-site`
   attribute changed between server and client.

---

## When to Stop and Ask

Escalate to the user — don't guess — for any of these:

- A target file already exists with non-trivial custom content.
- The host already binds `EmporixCMSComponentService` to a different
  class.
- The host's `next.config.*` already sets conflicting CSP /
  `X-Frame-Options` headers.
- A route group exists under `[locale]/` whose CMS intent is
  ambiguous (chrome layout vs. plain pass-through).
- `npm run generate` fails with errors that aren't obviously about
  this extension.
- The user asks you to author component definitions, decorators, or
  theme variables — those are catalogue decisions, not install
  decisions.

---

## Post-Install Protocol

After completing every install, write a file named
`CMS-INSTALL-PROTOCOL.md` at the host repo root. It is the
hand-off artefact for the user — they should be able to read it once
and know exactly what was changed and what they still need to do.

The file MUST have two clearly separated top-level sections:

### Section 1 — What was done

A bullet list of every step that the agent completed, in install
order. Include file paths for every file created or modified, env
keys added, components registered, layouts wrapped. Be specific:
"Created `src/components/cms-custom/hero-banner.tsx` (1 of N
catalogue components)" beats "added components."

### Section 2 — What still needs manual action

A bullet list of every loose end the agent could not complete on its
own. Each item should be actionable, ordered, and tagged with where
to do it (CMS editor, env file, code review, etc.). Typical entries:

- env values that the user must fill in (e.g. `CMS_EDITOR_ORIGINS`,
  `NEXT_PUBLIC_CMS_EDITOR_API_KEY`)
- CMSLayout entities to author in the editor (one per `layoutId`
  used in route-group layouts), populated with the layout-level
  slots the storefront exposes
- CMSPage entities to author for each predefined-slug route
- Re-picks the user must do in the editor when a field schema
  changed mid-install (e.g. `media` ↔ object form)
- Decisions deferred to the user (which routes to make CMS-driven,
  whether to wrap remaining layouts, etc.)
- Restart-required env changes
- Pre-existing host TS errors the agent left in place (do not
  silently fix unrelated host issues)

Do not bury the protocol file inside the extension folder — it
belongs at the host repo root next to `package.json`.

---

## What This Guide Does NOT Cover

For everything else — schema details, postMessage protocol, theme
override mechanics, slot-based architecture, troubleshooting beyond
the verification checklist — defer to [INSTALLATION.md](./INSTALLATION.md)
and the docs under [`docs/`](./docs/). This file is intentionally
thin: install correctly, then hand off to a human for catalogue
work.
