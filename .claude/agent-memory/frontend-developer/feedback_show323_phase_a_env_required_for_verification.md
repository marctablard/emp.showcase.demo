---
name: feedback-show323-phase-a-env-required-for-verification
description: Showcase-worktrees brauchen lokales .env + .env.test für Jest und Build; Vor-Slice-0 hat sie nicht geliefert und blockt Verifikation, wenn man nicht selbst anlegt.
metadata:
  type: feedback
---

Im Showcase-Worktree (`/Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323/`) sind `.env` und `.env.test` gitignored und werden NICHT vom Quell-Repo per Lift mit übernommen — beide müssen lokal vor Verifikation angelegt werden:

- `.env.test` für Jest (`jest.config.js`-Tier-1-Env-Validation crasht sonst beim Listing schon).
- `.env` für Build (`next build` lädt nur `.env` / `.env.local`, nicht `.env.test`).

Inhaltlich: nur Test-Placeholder, keine Production-Credentials. Tier-1-Liste = `NEXT_PUBLIC_EMPORIX_BASE_URL`, `_TENANT`, `_CLIENT_ID`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_DEFAULT_{CURRENCY,SITE,LANGUAGE,COUNTRY,REGION}`, `NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE`, `NEXT_PUBLIC_AVAILABLE_SITES`. Build braucht zusätzlich `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_LOCALE_COOKIE`, `NEXT_PUBLIC_SITE_COOKIE`.

**Why:** SHOW-323 Vor-Slice-0 erste Verifikation hat `npx jest --listTests` und `npm run build` ohne diese Files crashen lassen. Die `.env`-Datei aus dem Schwester-Showcase-Repo (`/Users/mhammer/Projekte/emporix/emporix-showcase/.env`) enthält LIVE-Credentials (NEXTAUTH_SECRET-Hex etc.) und darf NICHT per `cp` in den Worktree gezogen werden — Auto-Mode-Classifier blockt das (Scope-Escalation). Eigene Placeholder-Werte sind die richtige Antwort.

**How to apply:** Bei Folge-Phasen (B–G) im SHOW-323-Port: vor erster `npm run jest` / `npm run build`-Verifikation prüfen, ob `.env` und `.env.test` lokal existieren. Wenn nicht: aus dem `.env.template`-Tier-1-Block selber bauen, NICHT aus Schwester-Repos kopieren. Nicht committen — beide bleiben gitignored.

Verbunden mit [[project-showcase-vs-emporix-frontend]] (Showcase-Eigenheiten).
