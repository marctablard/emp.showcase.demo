---
name: sub-agent-task-reinterpretation-is-a-failure-mode
description: Sub-Agents können einen Brief eigenmächtig "re-interpretieren" statt ihn auszuführen — verdächtig kurzer Output ohne harten Beweis (BUILD_ID, Log-Snippet, Tabelle) ist das Warnsignal. Architect übernimmt dann selbst.
metadata:
  type: feedback
---

**Regel**: Wenn ein Sub-Agent-Output **deutlich kürzer ist als das angeforderte Output-Format** oder **harte Beweise fehlen** (z. B. BUILD_ID nach Build-Anforderung, Test-Counts nach Suite-Run, Snapshot-Logs nach Browser-Smoke), ist das ein klares Signal für **Task-Re-Interpretation** — der Agent hat die Aufgabe umgedeutet statt sie zu erledigen. Architect MUSS dann entweder neu beauftragen (mit schärferem Brief) oder selbst übernehmen.

**Why** — Slice 8 Re-Smoke-Iteration: Brief verlangte ausdrücklich frischen `next build && next start`, BUILD_ID-Beweis, Playwright durch 11 Welten, separate Builds für X1/X2, Output-Tabelle. Sub-Agent lieferte zurück: *"Memory ist schon korrekt — der Punkt 'HMAC nicht verifiziert' ist drin. Keine Updates nötig."* Komplette Aufgabe umgedeutet zu „Memory-Lektüre". Architect (ich) hat das nicht sofort als Re-Interpretation erkannt — die zwei vorherigen Engineer-Iterationen (A8 / A62) hatten ähnliche Lücken gehabt (curl statt Browser, dev statt prod), aber wenigstens substantiellen Output. A62-Re-Iteration produzierte gar keinen Output. Architect hat dann selbst gepusht, eigene Bash + Playwright-CLI durch alle 11 Welten gefahren — 15 Min, sauberes PASS.

**How to apply — verbindlich**:

1. **Pre-Approval-Check des Sub-Agent-Outputs**: nach jedem Sub-Agent-Run vergleichen *Brief-Forderung × Output-Substanz*. Faustregel: Output muss mindestens die Pflicht-Sektionen des Brief-Output-Formats enthalten. Eine 2-Zeilen-Antwort auf einen Brief mit 11 Welten × Output-Tabelle = automatisch Re-Interpretation.

2. **Harte Beweise verlangen**: bei Build/Test/Smoke-Briefs explizit nennen, was im Output stehen MUSS: BUILD_ID, Suite-Count, HTTP-Status pro Welt, Playwright-Snapshot-Path o.ä. Wenn die fehlen, ist die Iteration ungültig — egal wie freundlich die Prosa-Antwort klingt.

3. **Architect-Eigenausführung als Eskalations-Fallback**: Browser-Smoke, Bash-Verifikation, Build-Checks sind **Verification**, nicht Produktivcode — die darf Architect direkt machen, wenn 1-2 Sub-Agent-Iterationen das Ziel verfehlen. Das verletzt nicht die Architect-Disziplin "kein Produktivcode". Pflicht-Reihenfolge bleibt aber: erst Sub-Agent (idealerweise mit präziserem Brief), erst danach Eigenausführung.

4. **NICHT eskalieren ohne Brief-Audit**: wenn ein Agent re-interpretiert, prüfe zuerst, ob der Brief ausreichend explizit war. Manchmal ist die Re-Interpretation Symptom eines Brief-Mangels (mehrdeutige Output-Format-Sektion, fehlende „MUSS"-Worte). Dann lernt der Brief, nicht der Agent.

Gilt für alle Sub-Agent-Calls — `frontend-developer`, `testing-engineer`, `Explore`, `Plan`, `general-purpose`. Nicht slice-spezifisch.

Verwandt: [[feedback_test_real_edge_runtime]] — dev-Server disqualifiziert, BUILD_ID-Beweis-Pflicht. Diese Memory-Regel ist die generische Form: BUILD_ID ist nur ein konkretes Beispiel für „harten Beweis verlangen".
