# EMP-20 — Architektur-Plan: STEP 3 entblocken + `NEXT_PUBLIC_CMS/STORYBLOK_*` → Server-Only

**Branch:** `feature/SHOW-323` · **Issue:** EMP-20 · **Phase:** F (Browser-Smoke) + neues Trailing-Refactor
**Trigger:** Board-Reject von `request_confirmation` mit Reject-Reason
> 1. Ich hab euch gesagt, wo ihr die Credentials her bekommen.
> 2. Wieso heissen die Variablen eigentlich noch `NEXT_PUBLIC_*`? Aufgabe war, dass diese Werte Server-Only sind und nur über Server-Actions in den Client kommen, die auch prüfen, ob der Client überhaupt Zugriff hat.

Dieser Plan adressiert beide Punkte.

---

## Punkt 1 — Credentials sind bereits im Repo (kein Board-Input nötig)

**Hypothese des Vorgängers (falsch):** STEP 3 braucht eine echte Storyblok-**Editor-Signed-URL** (HMAC-Token + Editor-Preview-Token).
**Realität (verifiziert):**

- `StoryblokPreviewAdapter` validiert HMAC-Content **NICHT** (FU-004, board-akzeptiert). Validiert wird nur:
  1. Presence der drei `_storyblok` / `_storyblok_tk[timestamp]` / `_storyblok_tk[token]` Keys.
  2. Timestamp-Fenster `now-3600..now+60`.
  3. Space-ID-Match: `_storyblok_tk[space_id]` === `getSpaceId()`.
  4. CDN-Draft-Fetch über den **Public-Access-Token** (CDN-Token, kein Editor-Token).
- Demo-Token aus `.env.template` (`uvTlxgRrZDSUyr4zftdoNgtt`) **funktioniert verifiziert** gegen `version=draft`:
  ```
  curl -s "https://api.storyblok.com/v2/cdn/stories/home?token=uvTlxgRrZDSUyr4zftdoNgtt&version=draft"
  → { story: { name: "Home", ... } }
  ```
- Echte Demo-Space-ID ist **`338074`** ("Emporix Showcase"), nicht `295018` wie aktuell im Spec-Default hardcoded:
  ```
  curl -s "https://api.storyblok.com/v2/cdn/spaces/me?token=uvTlxgRrZDSUyr4zftdoNgtt"
  → { space: { id: 338074, name: "Emporix Showcase", ... } }
  ```

**Konsequenz:** STEP 3 ist mit Repo-Mitteln vollständig fahrbar — eine selbstkonstruierte URL mit beliebigem Token-Content, `space_id=338074`, in-window-Timestamp und Slug `home` läuft die Adapter-Pipeline durch. Zwei kleine Patches:

- `.env.template` Default für eine **neue** Variable `NEXT_STORYBLOK_SPACE_ID` (nach Migration, siehe Punkt 2) bzw. übergangsweise `NEXT_PUBLIC_STORYBLOK_SPACE_ID=338074`.
- `e2e/preview-route.spec.ts` Default `configuredSpaceId` `'295018' → '338074'` (im `E2E_PREVIEW_SPACE_ID`-Fallback).

---

## Punkt 2 — Inventar `NEXT_PUBLIC_CMS/STORYBLOK_*` + Migrations-Plan

### Inventar (`process.env.NEXT_PUBLIC_*` Lesepunkte, `src/`)

| ENV-Schlüssel | Server-Konsumenten | Browser-Konsumenten | Status |
|---|---|---|---|
| `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` | `StoryblokCmsApi`, `CmsProviderResolver`, `env-validation`, Contract-Tests | **`StoryblokBridgeScript.tsx`** (`'use client'`) · **`storyblok-banner-api.ts`** (Modul-Top-Level Browser) | **Echter Client-Bedarf — Bridge + Banner** |
| `NEXT_PUBLIC_STORYBLOK_SPACE_ID` | `StoryblokCmsApi.getSpaceId`, `StoryblokPreviewAdapter` warn-log | – | **Server-only, trivial umbenennbar** |
| `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` | `StoryblokCmsApi`, `StoryblokCmsAdapter` | – | **Server-only** |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` | `StoryblokCmsApi` | **`use-banner.ts`** (Hook) | **Echter Client-Bedarf — Banner** |
| `NEXT_PUBLIC_CMS_PROVIDER` | `CmsProviderResolver` (instrumentation.ts), Preview-Detector-Registry | – | **Server-only** |
| `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` | `CmsProviderResolver` | – | **Server-only** |
| `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` | `LocalJsonCmsAdapter` über `public-default-env.ts` | (potenziell Browser, falls in Client-Adapter geladen) | Halten / prüfen |
| `NEXT_PUBLIC_CMS_PAGE_CACHE_TTL_MS` / `_LAYOUT_CACHE_TTL_MS` | `cms-cache.ts` | – | **Server-only** |

### Migrationsplan (eigenes Child-Issue, vorgeschlagen als `EMP-21`)

**Phase A — trivial-server-only (no behavior change):**
1. Variablen umbenennen:
   - `NEXT_PUBLIC_STORYBLOK_SPACE_ID` → `NEXT_STORYBLOK_SPACE_ID`
   - `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` → `NEXT_STORYBLOK_MULTI_SITE`
   - `NEXT_PUBLIC_CMS_PROVIDER` → `NEXT_CMS_PROVIDER`
   - `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` → `NEXT_CMS_FALLBACK_PROVIDER`
   - `NEXT_PUBLIC_CMS_PAGE_CACHE_TTL_MS` → `NEXT_CMS_PAGE_CACHE_TTL_MS`
   - `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS` → `NEXT_CMS_LAYOUT_CACHE_TTL_MS`
2. Tests, `.env.template`, `docs/environment-variables.md`, `env-validation.ts` mitziehen.
3. Drift-Test: `git grep '@/lib/client.*NEXT_PUBLIC_STORYBLOK\\|NEXT_PUBLIC_CMS_'` muss leer bleiben.

**Phase B — Server-Action für Bridge (`StoryblokBridgeScript`):**
1. Server-Action `getStoryblokBridgeConfig(): Promise<{ accessToken: string } | null>` in `src/app/_actions/storyblok-bridge.ts`:
   - Access-Check: nur wenn `headers().get('x-cms-preview-route') === '1'` (von Middleware gesetzt für `/preview/...`) **und** Request kommt aus `iframe` (Header `sec-fetch-dest=iframe` oder `_storyblok` Query in Referer).
   - Sonst: `null` (No-Op).
2. `StoryblokBridgeScript.tsx`:
   - Ersetze `process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` durch `await getStoryblokBridgeConfig()`.
   - Token wird nur an `storyblokInit({ accessToken })` weitergereicht — Modul-internes State, kein DOM-Leak.
3. Bridge nur in `/preview/[site]/[locale]` Layout mounten — ist heute schon so.

**Phase C — Server-Action für Banner (`use-banner.ts`):**
1. Server-Action `fetchTopBanner({ locale }): Promise<TopBannerData | null>` in `src/app/_actions/cms-banner.ts`:
   - Liest `NEXT_STORYBLOK_ACCESS_TOKEN` + `NEXT_STORYBLOK_ACCESS_PREVIEW` server-side, ruft Storyblok CDN.
   - Access-Check: trivial (kein Auth-Token nötig — Banner ist public content; aber: zentralisiert + zukunftsfest, da Token nicht mehr Browser-leaked).
2. `use-banner.ts`:
   - Ersetze `getStoryblokApi()` Browser-Init durch Server-Action-Call.
   - Banner-Store / SSR-Caching bleibt.
3. `storyblok-banner-api.ts` löschen.
4. `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` und `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` werden zu `NEXT_STORYBLOK_*`.

**Phase D — Drift-Tests + Hardening:**
1. Drift-Test: `git grep 'NEXT_PUBLIC_STORYBLOK_\\|NEXT_PUBLIC_CMS_' src/` muss nach Migration leer sein (ausser für Phase-A-Renames).
2. Drift-Test: `grep -c 'NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN' .next/static/chunks/*.js` MUSS `0` sein nach `next build`. Edge-Bundle-Guard `scripts/preview-smoke.sh` um Browser-Bundle-Check erweitern.
3. ESLint-Regel: `no-restricted-properties` für `process.env.NEXT_PUBLIC_STORYBLOK_*` (verbietet Reintroduction).

### Aufwand

- Phase A: ~1h (mechanisches Rename + Test-Anpassung)
- Phase B: ~2-3h (Server-Action + Access-Check + Test)
- Phase C: ~2-3h (Server-Action + Hook-Refactor + Test + SSR-Hydration prüfen)
- Phase D: ~1h
- **Gesamt: ~8h** — eigenes Child-Issue (NICHT in EMP-20 Scope, weil EMP-20 Browser-Smoke-Acceptance ist).

---

## Disposition für EMP-20 (nach diesem Heartbeat)

1. **Punkt 1 lösen — STEP 3 fahren.** Direkt in diesem Worktree: Space-ID `338074` setzen (`.env.template`-Hinweis + Spec-Default-Fix), Build + Start, Playwright-Spec mit konstruierter Signed-URL. Wenn grün → STEP 3 done.
2. **Punkt 2 ablegen — neues Child-Issue.** Server-Only-Migration ist außerhalb des EMP-20-Scopes (Browser-Smoke-Acceptance). Vorschlag: Child-Issue **EMP-21** mit obigen Phasen A–D, blockiert NICHT EMP-20.
3. EMP-20 final disposition: `done` (wenn STEP 3 grün) oder `in_review` (wenn nur Plan + Spec-Korrektur).

