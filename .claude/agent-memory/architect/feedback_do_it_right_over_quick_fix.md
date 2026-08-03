---
name: do-it-right-over-quick-fix
description: User wählt IMMER "richtig machen" über Quick-Fix/Workaround. Bei Quick-vs-Correct-Gabelungen den korrekten Weg als Default nehmen, nicht den schnellen als gleichwertig framen.
metadata:
  type: feedback
---

**Regel**: Wenn eine Entscheidung einen Quick-Fix/Workaround gegen eine korrekte/gründliche Lösung stellt, ist die Antwort des Users **immer** "richtig machen". Den korrekten Weg als Default nehmen und umsetzen — den Quick-Fix nicht als gleichwertige Co-Option präsentieren.

**Why:** Explizite Aussage 2026-05-20: *"wenn du mich fragst, ob ich nur einen Quick-Fix will oder ob ich es richtig machen will, wird meine Antwort immer sein: Mach es richtig."* Konsistent mit dem ganzen SHOW-323-Verlauf: voller SDK-Pivot statt `router.refresh()`-Hack; Pivot-Debris geradeziehen statt liegen lassen; Caching-Subsystem funktional machen (Next `revalidateTag`) statt tot löschen; *"Code, den ich ruhigen Gewissens einem anderen Entwickler ins Review geben kann."*

**How to apply:**
- Bei Architektur-/Refactor-/Cleanup-Gabelungen: die korrekte Lösung wählen und durchziehen. Quick-Fix nur erwähnen, wenn es einen echten zeitkritischen Grund gibt — dann als Notlösung kennzeichnen, nicht als gleichwertig.
- Halb-tote/verwaiste Subsysteme (durch Pivots entstanden): entweder korrekt funktional machen oder sauber entfernen — nie halb-tot liegen lassen.
- Review-Readiness ist die Messlatte: würde ein anderer Entwickler im CR darüber stolpern? Dann ist es nicht fertig.
- Test-Contract-Drift / Loosen von Asserts bleibt verboten ([[feedback_quality_gates_per_slice]]) — "richtig" heißt auch hier: Strenge erhalten/erhöhen.
- Gilt NICHT als Freibrief für unbegrenzten Scope-Creep: "richtig" heißt die saubere Lösung für das vorliegende Problem, nicht das Anschleppen unverwandter Refactors. Bei echtem Scope-Sprung weiter Stop-and-Ask, aber mit klarer Empfehlung für den korrekten Weg.
