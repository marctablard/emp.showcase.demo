---
name: non-blocking-over-fresh
description: Caching/Perf-Default — non-blocking stale-while-revalidate wird blockierender Freshness vorgezogen. Schnelle, evtl. Sekunden-veraltete Antwort > Warten auf frische Antwort.
metadata:
  type: feedback
---

**Regel**: Bei Caching-/Revalidierungs-Entscheidungen ist **non-blocking (stale-while-revalidate)** der Default gegenüber blockierender Freshness. Eine schnell antwortende Seite, die evtl. ein paar Sekunden veraltet ist, ist besser als eine, auf die man wartet und die dann aktuell ist.

**Why:** User-Aussage 2026-05-20: *"Eine schnell antwortende Seite, die vielleicht 5 Sekunden veraltet ist, ist besser als eine, auf die man 5 Sekunden wartet, die dann aber aktuell ist."* Konkret entschieden für den CMS-Publish-Webhook: `revalidateTag(tag, 'max')` (stale-while-revalidate, Hintergrund-Refetch) statt `{ expire: 0 }` (sofortige Expiration, blockierender Refetch beim nächsten Besucher). Begründung des Users: im Hintergrund in Ruhe neu rendern, ausspielen wenn fertig.

**How to apply:**
- Next-Caching: `revalidateTag(tag, 'max')` bevorzugen, nicht `{ expire: 0 }` — außer es gibt eine harte Korrektheits-/Compliance-Anforderung für sofortige Konsistenz (z.B. Preise, Verfügbarkeit, rechtlich relevante Inhalte) — dann nachfragen.
- Allgemein: ISR/SWR/Hintergrund-Revalidierung gegenüber blockierenden Refetches im Render-Pfad. Time-to-first-byte / Responsiveness schlägt absolute Aktualität für Content.
- Live-Edit-/Preview-Pfade bleiben davon unberührt (draft `revalidate:0`, sofortige Sichtbarkeit für Redakteure ist dort gewollt).
- Gilt als Default-Heuristik, nicht als Dogma: bei Inhalten, wo Veraltung echten Schaden anrichtet, explizit abwägen.
