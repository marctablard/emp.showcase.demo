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
6. **Run `npm run generate-di` after every DI-affecting change** —
   creating a new injectable, changing the extension's contents,
   restoring it from a fresh checkout. Verify the command exits 0
   before proceeding.

---

## Pre-flight (do this first, in one batch)

Run these read-only checks in parallel before any edits, so you know
what state the host repo is in:

- `extensions/medienwerft-cms-plugin/plugin.json` exists → extension is present.
- `package.json` contains a `generate-di` script.
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
- Run `npm run generate-di`. If it exits non-zero, stop and surface
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
- Re-run `npm run generate-di` after creating the file.

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
    `fetchCMSPage` is `'notFound' in data` (capital N, lowercase ound).
    Don't write `'notfound'` — that branch never fires.

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

1. `npm run generate-di` exits 0.
2. `npx tsc --noEmit` (or the project's typecheck script) passes.
   Type errors here usually mean a mis-pathed import.
3. `npm run dev` starts cleanly. The dev banner from
   [`cms-setup-missing-banner.tsx`](./components/cms-setup-missing-banner.tsx)
   should **not** appear — if it does, the
   `EmporixCMSComponentService` binding is missing or mis-named.
4. Loading any storefront page in a browser does not 404 on
   `/<site>/cms-theme.css` (check the Network tab). A 404 means
   Step 5 was skipped or the folder name is wrong.
5. The page renders without React hydration warnings about mismatched
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
- `npm run generate-di` fails with errors that aren't obviously about
  this extension.
- The user asks you to author component definitions, decorators, or
  theme variables — those are catalogue decisions, not install
  decisions.

---

## What This Guide Does NOT Cover

For everything else — schema details, postMessage protocol, theme
override mechanics, slot-based architecture, troubleshooting beyond
the verification checklist — defer to [INSTALLATION.md](./INSTALLATION.md)
and the docs under [`docs/`](./docs/). This file is intentionally
thin: install correctly, then hand off to a human for catalogue
work.
