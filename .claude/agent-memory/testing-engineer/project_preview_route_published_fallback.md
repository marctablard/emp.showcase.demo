---
name: preview-route-published-fallback
description: /preview/[site]/[locale]/[[...slug]] page hits without a valid token render the published body wrapped in data-preview-route="published-fallback"
metadata:
  type: project
---

A direct hit on `/preview/<site>/<locale>/<slug>` without any preview-signed
query keys (or with incomplete tripel, or with stale timestamp, or with
mismatched space_id) does NOT 404. The agnostic preview page falls through
to `cms.renderPage(...)` and wraps the published body in
`<div data-preview-route="published-fallback">`. `notFound()` is only called
when even the published fallback yields null.

**Why:** Bookmarks, bots, and middleware-rewrites that landed on `/preview/...`
because of presence-only detection must not crash; rendering published content
is the safe default. The `published-fallback` data-attribute is the smoke-
test anchor for "preview path executed, validation rejected, public content
served, no bridge mounted."

**How to apply:**
- In browser-smokes, treat presence of `data-preview-route="published-fallback"`
  as the affirmative proof of safe rejection (not absence of bridge alone).
- Live-preview success (bridge mounted, `data-blok-*` anchors present) requires
  a real `space_id` that matches `api.getSpaceId()` AND a fresh timestamp —
  middleware rewrite alone is insufficient because Step 3 of
  `validateStoryblokPreview` gates the bridge-mount.
- The middleware rewrite presence-check is PRESENCE-ONLY (no HMAC verification
  in source). HMAC is mentioned in code comments as the format of the
  `[token]` value but is NOT verified at runtime. Smokes therefore use a
  dummy HMAC; only space_id + timestamp matter for adapter-side gating.
