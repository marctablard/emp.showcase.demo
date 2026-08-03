---
name: server-action-uses-server-container
description: App-Router-Server-Actions (`'use server'` in src/app/_actions/*) nutzen den `@/platform/server`-DI-Container, NICHT `@/platform/ssr` — analog API-Route-Handlers in src/app/api/*
type: feedback
---

Bei Briefs für Sub-Agents, die `'use server'`-Module unter `src/app/_actions/` neu anlegen, **immer `@/platform/server` als DI-Container vorschlagen**, nicht `@/platform/ssr`.

**Why:** Server-Actions sind Browser-initiated POST-Roundtrips (analog API-Routes), nicht RSC-cached SSR-Functions. Beide Container haben `LoggerService` registriert (`PinoLoggerServiceServer` vs. `PinoLoggerServiceSSR`), funktional würden beide laufen — aber das semantisch passende Pattern ist:

- `@/platform/server` → API-Routes (`src/app/api/**`) UND Server-Actions (`src/app/_actions/**`). Browser → POST → server pipeline.
- `@/platform/ssr` → RSC-Cache-wrapping (`src/lib/ssr/*.ts`). React-Server-Components rufen es im Render-Tree.

Die existierenden `'use server'`-Module in `src/lib/ssr/*.ts` (`customer.ts`, `carts.ts` etc.) sind irreführend: sie tragen die Direktive, weil React sie aus Client-Components rufen können soll, sind aber semantisch Read-through-Caches für RSC (`cache(...)` wrapper) — nicht Browser-initiated Actions. Daher dort `@/platform/ssr`. Verwechselungsgefahr.

**How to apply:**
- Beim Plan/Brief-Schreiben für neue Server-Actions in `src/app/_actions/**`: konkret `ssr.get<...>` als Vorschlag VERMEIDEN, stattdessen `server.get<...>` aus `@/platform/server`.
- Pre-Impl-Tests sollten `jest.mock('@/platform/server', ...)` pinnen — wenn der frontend-developer das ändert, kontaminiert er den Vertrag.
- Lerne: 2026-05-31 EMP-21 Phase B — Brief sagte `ssr.get`, sub-agent korrigierte korrekt auf `server.get` basierend auf Test-Mock + API-Route-Pattern.
