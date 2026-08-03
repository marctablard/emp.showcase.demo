---
name: show323-e2e-home-404-emporix-auth
description: SHOW-323 Phase A Live-Smoke — Home liefert 404 ohne Emporix-Auth, was AC#2/E2E rot färbt obwohl CMS-Token-Empty-Pfad sauber ist
metadata:
  type: feedback
---

`NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN=` `npm start` bootet sauber (kein Module-Load-Crash, kein Storyblok-Init), aber `GET /` antwortet **404**, weil Site-Routing `bk.getPublicToken` braucht und ohne valide `NEXT_EMPORIX_CLIENT_ID/SECRET` `Invalid ApiKey` wirft. `/api/health` + `/api/ready` antworten 200 (Liveness ist OK).

**Why:** AC#2 misst „Home 200 + kein access-token-Console-Error". Die Token-Empty-Regression (Storyblok `storyblokInit()` crash) ist nachweislich weg — Server bootet ohne Crash, Log enthält keinen `Module not found` und kein Storyblok-Init-Error. Die 404 kommt aus einer **anderen Layer** (Emporix-API-Auth → Site-Resolve), die in der Worktree mit Placeholder-`.env` nicht funktioniert. Verwandt: [[feedback_show323_phase_a_env_required_for_verification]].

**How to apply:**
- Live-Smoke-AC für Token-Empty-Boot ist **nur grün stellbar mit validen Emporix-API-Credentials in `.env`** (NEXT_EMPORIX_CLIENT_ID/SECRET die echtes anonymes Token liefern). Worktree-Placeholder reicht für Build (AC#1) und Boot-Smoke (kein Crash), aber nicht für HTTP-200-Home.
- Bei Live-Smoke-Aufträgen, die HTTP-200 von `/` fordern, **vorher prüfen** ob Emporix-Site-Auth in der Worktree funktioniert (z. B. `curl /api/site` testen). Wenn nicht: an Architect eskalieren, nicht selbst Token besorgen oder Test umbauen.
- Beweis-Kette für „CMS-Token-Empty-Pfad sauber": (1) Build exit=0, (2) Server-Boot-Log frei von `Module not found`/Storyblok-Init-Error, (3) Healthcheck-Warning `falls back to "none"` ist erwartet — reichen aus, um AC#1 + den Storyblok-Anteil von AC#2 zu zeigen.
- `playwright.config.ts` hat `webServer.command: 'npm run dev'` + `reuseExistingServer: !CI` → lokal nutzt der Test den laufenden `next start`-Build (Liveness via `/api/health`). Kein Mode-Switch nötig.
