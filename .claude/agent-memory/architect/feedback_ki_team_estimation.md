---
name: feedback-ki-team-estimation
description: Zeitschätzungen mit KI-Agententeam-Geschwindigkeit denken, nicht Solo-Entwickler-Schätzung — sonst werden korrekte Strategien fälschlich als zu teuer abgelehnt
metadata:
  type: feedback
---

Schätzungen für Implementierungs-Aufwände müssen die KI-Agententeam-Geschwindigkeit zugrunde legen (Architect + frontend-developer + testing-engineer parallel/sequenziell, hybrid-TDD-Loop), nicht den Solo-Entwickler-Maßstab. Wenn eine Aufgabe mit Architektur-Spec, Reference-Implementation und Test-Vorlagen aus einem Quell-Repo verfügbar ist, sind Tages-Schätzungen, keine Wochen-Schätzungen das richtige Raster.

**Why:** User-Korrektur 2026-05-26 zur Strategie-F-Diskussion (SHOW-323-Reimplementation): Architect schätzte "Wochen statt Tage" — User korrigierte: das ist die Solo-Schätzung, mit Agententeam ist 1–2 Tage realistisch. Konsequenz war, dass ich Strategie F (saubere Reimplementierung) fälschlich als zu teuer einrahmte und Strategie E (Code-Port mit Memory-Regel-Workarounds) als pragmatisch verkaufte. Falsche Trade-off-Darstellung.

**How to apply:**
- In Architekt-Plänen und Trade-off-Listen Zeitaufwände in **Tagen oder Stunden** ausweisen, nicht Wochen, sobald Quell-Spec + Reference-Implementation + Test-Vorlage existieren.
- Mehrarbeit gegen "schmutzigen" Quick-Fix nicht durch Aufwand-Argument abwerten — Memory-Regel `feedback_do_it_right_over_quick_fix` dominiert die Geschwindigkeits-Erwägung.
- Bei Schätzungen explizit machen: "mit Agententeam ca. X Slices à Y Stunden". Solo-Vergleich nur anführen, wenn der User danach fragt.
- Sub-Agent-Briefs profitieren von Quell-Repo als Vorlage massiv — der Pfad zur Quell-Implementation/zum Quell-Test gehört in jeden Brief.
