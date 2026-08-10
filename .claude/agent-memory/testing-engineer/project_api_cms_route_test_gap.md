---
name: api-cms-route-test-gap
description: RESOLVED — api/cms/route.test.ts ported in Phase C (dcbc2090); route was byte-identical, test green, +5 cases
metadata:
  type: project
---

`src/app/api/cms/route.ts` (`GET /api/cms`) predates Slice 4 (exists since `59e1c87f` Local CMS impl) and has **never** had a test in the showcase branch. The Phase-C fix (`a63ebfbf`) switched its `ssr.get('CMSService')` to `await getCmsService()` — route.ts is now byte-identical to the source-repo version (`imported/SHOW-323`).

The source-repo ships a full route-handler test `src/app/api/cms/route.test.ts` (commit `b06747d0`) covering: happy-path slug/locale/site forwarding, default query params, notfound verbatim (200), service-throws → 500 + LoggerService.error, getCmsService-rejects → 500.

**Why this is the load-bearing gap:** route handlers are NOT covered by the production HTML smoke (smoke uses `Accept: text/html` against page routes, not the `/api/cms` JSON endpoint). The 500 catch-branch + slug-parsing/defaults are pure logic with zero coverage. The other two untested callers (generateMetadata, layout BridgeScript) are thin and DO sit on the HTML render path the smoke exercises.

**RESOLVED 2026-05-27 (commit `dcbc2090`):** Ported verbatim from `imported/SHOW-323` — route was confirmed byte-identical so no spec drift. Template was already English with no task-internals, so no rewrite needed beyond Gate-6 verification. All 5 `it` cases green, full suite 1091 passed, tsc/lint clean. testMatch + node env worked with zero config change. Pattern: when source route is byte-identical, a coverage-backfill port is a green-from-the-start no-risk add.
