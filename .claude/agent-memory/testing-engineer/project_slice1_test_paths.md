---
name: slice1-test-paths
description: Slice 1 CMS-Adapter-Framework Test-Pfade und Test-Project-Zuordnung in showcase
metadata:
  type: project
---

Slice-1-Pre-Implementation-Tests committed auf `feature/SHOW-323` (Commit `5fc16f3d`).

**Test-Project-Zuordnung (Jest projects config):**

- `src/platform/**/*.test.ts(x)` → "Platform Tests" (node env). Trifft:
  - CmsProviderResolver.test.ts
  - NullCmsAdapter.test.ts + .contract.test.ts
  - DelegatingCmsServiceSSR.test.ts
  - LocalJsonCmsAdapter.test.ts + .contract.test.ts
  - env-validation.test.ts (existing)
- `src/hooks/**/*.test.tsx` → "React Tests" (jsdom). Trifft:
  - use-banner.test.tsx
- `e2e/*.spec.ts` → Playwright (Jest skips via testPathIgnorePatterns).

**Drift-Pin im env-validation.test.ts**: das Test-File pinned die exakte
OPTIONAL_ENV_VARS-Liste via `toEqual([...])`. Wenn neue Optional-Vars hinzukommen,
muss dieser Pin mit-aktualisiert werden — sonst bricht der Test.

**Why:** Knowledge für Folge-Slices, damit jeder Test sofort im richtigen
Project gepickt wird. Adapter-Contract-Helper ohne `.test.`-Endung wird
NICHT gepickt — Runner-Pattern (`*.contract.test.ts` importiert den Helper).

**How to apply:** Wenn neue CMS-Adapter dazukommen (Slice 4: StoryblokCmsAdapter),
liegt deren Test gleichermaßen in `src/platform/integrations/<id>/cms/impl/`
und wird von "Platform Tests" gepickt. Renderer-/JSX-Tests müssen in `hooks/`,
`providers/`, `components/cms/`, oder `**/*.render-page.test.tsx` liegen, um
in "React Tests" zu landen (siehe jest.config.js).
