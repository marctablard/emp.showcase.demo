---
name: sub-agents-must-run-in-background
description: Sub-Agents IMMER im Background spawnen (run_in_background true), damit Architect für User-Nachrichten ansprechbar bleibt
metadata:
  type: feedback
---

Sub-Agents (`frontend-developer`, `testing-engineer`) MÜSSEN mit `run_in_background: true` gespawnt werden — niemals im Foreground.

**Why:** Foreground-Spawns blockieren den Architect für die gesamte Sub-Agent-Laufzeit (oft 5-20+ Minuten). User-Nachrichten in dieser Zeit kommen erst nach Sub-Agent-Completion an. User-Wortlaut 2026-05-20: *"Ich schicke dir schon die 3. Nachricht, die bei dir nicht ankommt, weil der Testing-Agent die Eingabe blockiert und bei dir nichts ankommt. Du reagierst nicht, und ich bin gerade ziemlich genervt."* Architect-Ansprechbarkeit ist Priorität gegenüber sequenzieller Spawn-Ordnung.

**How to apply:**
- Jeder Sub-Agent-Spawn: `run_in_background: true` setzen.
- Nach Spawn: User mit Status-Übersicht antworten (welcher Agent läuft mit welcher ID), Architect bleibt für weitere User-Inputs offen.
- Mehrere Agents parallel statt sequenziell, wenn die File-Sets nicht überlappen — siehe [[feedback_quality_gates_per_slice]] für Cross-Review-Sequenz (die bleibt sequenziell wegen Deadlock-Risiko in einer Nachricht, aber Implementation-Tasks dürfen parallel laufen).
- Bei Completion: System schickt `task-notification` automatisch — kein Polling, kein Sleep.

**Exception:** Nur dann Foreground, wenn das nächste Architect-Handling **zwingend** das Sub-Agent-Result als Input braucht UND keine andere User-Interaktion in dieser Zeit zu erwarten ist. Default ist Background.
