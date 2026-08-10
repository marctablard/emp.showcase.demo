---
name: feedback-cross-review-discipline
description: Approve gibt es erst bei 0 Findings, egal wer reviewed. Cross-Review wird so streng wie möglich gefahren. "PASS mit Follow-up", "Approve with fix blockers", "Caveat" oder "minor reicht für Push" sind verbotene Kategorien.
metadata:
  type: feedback
---

**Regel**: Ein Approve ist erst dann ein Approve, wenn der Reviewer **0 Findings** zurückgibt. Egal wer reviewed (Architect, testing-engineer, frontend-developer, User). Egal welche Severity. Egal ob "follow-up wäre auch OK". Wenn Findings da sind, werden sie gefixt. Sonst kein Approve.

**Why:** Im SHOW-323 Slice 3 hatte ich nach Iteration 2 eine PASS-mit-Minor-und-Nit-Empfehlung gegeben — testing-engineer-Verdict war "PASS mit drei Minors + vier Nits als follow-up-Tickets, kein Block für Push". Das war meine fehlerhafte Auslegung. User hat klargestellt: solche Konstrukte ("Approve with fix blockers", "PASS mit Caveat", "minor reicht") sind nicht legitim. Begründung des Users: Findings, die als "Follow-up" wegmoderiert werden, häufen sich in Codebases an und werden nie gefixt. Wer findet, hat einen Grund — entweder ist der Grund stichhaltig (= Fix), oder die Findung sollte gar nicht erst geäußert werden. Mittelweg gibt es nicht.

Konsequenz für mich (Architect):
- "Empfehlung: PASS" sage ich nur bei **wörtlich 0 Findings** in meinem eigenen Audit UND 0 Findings in jedem parallelen Reviewer-Audit.
- Wenn ein Reviewer 1 Nit findet: Fix-Loop, danach erneutes Audit, nicht "Nit ist nice-to-have, lass uns mergen".
- FU-Stories sind weiterhin legitim für **Architektur-Erweiterungen**, die einen neuen Slice eröffnen würden (Beispiel: FU-002 E2E-Setup). Sie sind NICHT legitim für Findings im laufenden Slice, die nur etwas Aufwand zum Fixen kosten würden.

Konsequenz für Reviewer-Briefings ([[feedback-use-client-audit]] greift parallel):
- "Strict-Modus: Findings = Fix-Pflicht. Iteration N+1 läuft nur, wenn Iteration N nicht 0 Findings hatte. Wenn du in Iteration 1 nichts findest, aber in Iteration 2 plötzlich was — das war ein Iteration-1-Selbst-Fail. Geh in Iteration 1 so tief wie nötig, damit Iteration 2 wirklich nichts mehr findet."
- "Strenge so hoch wie möglich. Wenn du dir bei einem potenziellen Finding unsicher bist, melde es. Lieber ein zu strenges Finding, das im Diskurs aufgelöst wird, als ein durchgewunkenes."
- "PASS mit Caveat / PASS-mit-Follow-up / Approve-with-fix-blockers gibt es nicht als Kategorie."

**How to apply:** 

Beim Schreiben jedes Cross-Review-Briefings (für `testing-engineer`, `frontend-developer`, oder Architect-Konsultation):

1. Ins Briefing wörtlich aufnehmen: *"Findings = Fix-Pflicht. PASS gibt es nur bei 0 Findings. Strict-Modus, kein 'minor reicht'."*
2. Severity-Definitionen aufnehmen, aber **alle** Severities lösen Fix-Pflicht aus, nicht nur Blocker/Major.
3. Im erwarteten Output-Format das Verdict-Feld auf zwei Werte beschränken: `PASS` (0 Findings) oder `FIX-AND-RETRY` (≥1 Finding, egal welche Severity).

Beim Schreiben meines eigenen Audit-Output an den User:
1. Wenn meine Findings-Liste leer und alle parallelen Reviewer 0 zurückgeben: "PASS" + Belege.
2. Wenn auch nur **ein** Finding offen ist: "FIX-AND-RETRY" + Findings-Liste + Fix-Auftrag.
3. Keine Sätze wie "Empfehlung PASS, drei Minors sind nicht-blockierend" — verboten.

Beim Plan-Dokument-Update (`.claude/SHOW-323-plan.md` §17.5):
- Decision 28 ("Differenzierte Review-Pflicht — Mini-Patch = Architect-Review reicht, Slice-Abschluss = full Cross-Review") wird ergänzt um: *"Approve = 0 Findings. Iterationen laufen, bis Reviewer 0 zurückgeben. Keine FU-Stories für Findings im aktiven Slice."*

Ausnahme — **ehrliche Limitierung**: Es gibt Findings, die wirklich einen neuen Slice öffnen würden (z. B. E2E-Setup mit CI-Anpassung). Wenn ein Reviewer so etwas findet, **flagged er es als "Slice-Erweiterungs-Empfehlung", nicht als "Finding zum Fixen"**. Die Architekt-Konsultation entscheidet, ob das wirklich ein Slice-Wechsel ist oder ein Fix-im-laufenden-Slice. Default-Annahme: Fix-im-laufenden-Slice. Slice-Wechsel ist die seltene Ausnahme.
