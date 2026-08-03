---
name: feedback-di-container-module-graph-split
description: Inversify-Container, die in `instrumentation.ts` mutiert werden, sind bei Next.js/Turbopack nicht garantiert die gleiche Instanz wie im Server-Component-Render-Pfad. Alias-Bindings müssen entweder im Container-Init selbst sitzen oder lazy per-Request gemacht werden, sonst kommt zur Render-Zeit ein "No bindings found"-Crash.
metadata:
  type: feedback
---

Bei Inversify-DI-Container-Aliases, die in `instrumentation.ts` per `bindCmsAdapterAlias` (oder analog) auf den Container-Default-Export gelegt werden, gilt: **Diese Aliases sind unter Next.js / Turbopack NICHT garantiert für den Server-Component-Render-Pfad sichtbar.** Turbopack kann `@/platform/ssr` (und damit den `initializeContainer()`-Aufruf) unter mehreren Module-Graphen evaluieren — Server-Instrumentation-Graph und Server-Component-Render-Graph sind separat. Die `instrumentation.ts`-Bindings landen auf einer Container-Instanz; der Render-Pfad bekommt eine andere.

**Why:** In SHOW-323 Schritt 4 habe ich die Page-Route auf `ssr.get<CMSService>('CMSService')` umgestellt. `DelegatingCmsServiceSSR` hat `@inject('CmsAdapter')`. Bei Boot loggt `instrumentation.ts` zweimal `CmsAdapter alias bound providerId=mock`, beim ersten Request schlägt die `getPage`-Call mit `Error: No bindings found for service: "CmsAdapter"`. Das war kein Race (Boot war 0,5s vor Request fertig) — der Render-Pfad hatte einen anderen Container.

**How to apply:** Für DI-Aliases, die ENV-getrieben sind und nicht statisch im `initializeContainer()` codiert werden können (z. B. weil `npm run generate` nur statische YAML-Aliases versteht), nicht auf `instrumentation.ts` allein verlassen. Stattdessen einen kleinen `getXxxService()`-SSR-Helper bauen, der:

1. Per `await import('@/platform/ssr')` den Container im aktuellen Modul-Graphen holt.
2. Per `container.isBound(aliasKey)` prüft, ob die Alias-Bindung schon da ist.
3. Wenn nicht: ENV resolven, Alias setzen (idempotent — Singleton-Wirkung bleibt erhalten, weil das Adapter-Ziel selbst ein Singleton ist).
4. `container.get(serviceKey)` returnen.

Beispiel im Repo: `src/platform/services/cms/get-cms-service.ts`. Pattern lässt sich für jeden ENV-getriebenen Adapter-Alias re-usen.

**Markierung der Helpers**: `import 'server-only'` ist Pflicht — die Helper sind nicht für Client-Components/Browser-Bundle sicher, weil sie den SSR-Container anfassen.

**Cleaner langfristig**: Die Alias-Bindung könnte in den `initializeContainer()`-Code selbst gezogen werden (in `src/platform/ssr.ts` und `src/platform/server.ts`), z. B. via ein "alias resolver"-Modul, das der DI-Generator emittet. Dann ist sie strukturell beim Container-Init drin und Module-Graph-Split irrelevant. Solange `npm run generate` das nicht emittet, ist der `get-cms-service.ts`-Helper die robuste Lösung.
