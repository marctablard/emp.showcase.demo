---
name: feedback-full-cross-review-chain-every-phase
description: Die volle Sub-Agent-Cross-Review-Chain (testing-engineer ↔ frontend-developer wechselseitig) ist Pflicht in JEDER Phase vor PR-Eröffnung — auch wenn nur ein kleiner Korrektur-Loop lief
metadata:
  type: feedback
---

Vor jedem Push + PR-Eröffnung muss die volle Sub-Agent-Cross-Review-Chain durchgelaufen sein, mit 0 Findings:
1. testing-engineer reviewt Implementation (AC-Coverage, ungetestete Pfade, Drift-Guard-Effectiveness, Mock-Korrektheit)
2. frontend-developer reviewt Tests (Test-Logik, Reverse-Coverage, Determinismus, Helper-Pickup)
3. Architect-CR (Schichten, DI, ENV, Memory-Regel-Grep) — zusätzlich, NICHT ersetzend

Beide Sub-Agent-Cross-Reviews sind Pflicht. Sequenziell wegen [[feedback-quality-gates-per-slice]] Anti-Pattern.

**Why:** 2026-05-26 in Phase B (SHOW-323-Reimplementation) — nach Architect-CR-Findings (Wording-Verstoß) ging Korrektur-Loop durch, ich habe das als "Phase fertig" interpretiert und PR direkt eröffnet. Habe testing-engineer Cross-Review auf Impl und frontend-developer Cross-Review auf Tests komplett übersprungen. User hat eskaliert: "Hast du Quality-Gate erfolgreich bestanden? Du hast vorher gesagt CR steht noch aus, jetzt machst du PR. Bist du wirklich durch?"

**How to apply:**
- Auch wenn Architect-CR clean und Tests grün sind, ist die Phase NICHT durch ohne beide Sub-Agent-Cross-Reviews mit 0 Findings.
- Korrektur-Loop-Ende ≠ Phase-Ende. Nach jeder Korrektur muss die Cross-Review-Chain (mindestens Spot-Check) durchgespielt werden — gilt auch wenn der Korrektur-Diff trivial ist (z. B. Wording-only).
- Vor Push + PR: explizit prüfen, ob testing-engineer auf Impl approved hat UND frontend-developer auf Tests approved hat. Falls eines fehlt: nicht pushen.
- "Architect-CR clean + Sub-Agent-Self-Verification (Lint+Build+Tests)" ist KEIN Ersatz für externe Cross-Review-Augen.
- Browser-Smoke ist eigener Schritt, kommt nach Sub-Agent-Cross-Reviews (nicht davor).
- Plan v3 §6 Workflow ist verbindlich — Schritt 5 (Cross-Review beidseitig) NIE überspringen.
