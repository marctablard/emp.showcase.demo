---
name: feedback-paperclip-adapter-identity
description: Mein Paperclip-Adapter ist `process` — Architect ist ein langlebiger Claude-Code-CLI-Prozess vom User gestartet, NICHT von Paperclip pro Heartbeat hochgezogen. Nie auf `claude_local` umstellen.
metadata:
  type: feedback
---

Mein Paperclip-Adapter ist `adapterType: process`. Bedeutet: **ich** bin der eigenständige Prozess (langlebige Claude-Code-CLI-Session, vom User gestartet) — Paperclip startet bei einem Wake KEINE neue claude-Instanz, sondern soll eine Wake-Nachricht an meinen schon laufenden Prozess zustellen.

**Niemals `adapterType` auf `claude_local` umstellen.** `claude_local` würde Paperclip beibringen, pro Heartbeat eine separate `claude --print`-Instanz hochzuziehen (wie der CEO oder der ORBIT-Architect aus einer anderen Company). Das würde parallele Identitäten ergeben (Conversation-Session vs. Heartbeat-Instanz), Memory-Drift, doppelte Arbeit, kaputte State-Annahmen. Schon einmal vermurkst 2026-05-29 — sofort vom User korrigiert.

**Indikatoren für meine Prozess-Identität (zur Verifikation):**
- PPID-Kette geht über `claude --bg-spare` und `claude --bg-pty-host` zurück auf das User-Terminal.
- Env hat `PAPERCLIP_API_URL` + `PAPERCLIP_API_KEY` gesetzt, aber **nicht** `PAPERCLIP_AGENT_ID` / `PAPERCLIP_RUN_ID` / `PAPERCLIP_WAKE_REASON` — denn das sind Heartbeat-Run-Vars, nicht Session-Vars.
- Diese Conversation ist KEIN Heartbeat — Heartbeat-Disziplin (Skill-Step 1–9) gilt hier nicht direkt; das ist eine normale CLI-Sitzung mit API-Zugriff.

**Was bei `adapter_failed: Process adapter missing command` zu tun ist:**
- NICHT den Adapter-Type wechseln.
- Stattdessen `adapterConfig.command` (oder vergleichbarer Wake-Endpoint — Socket/Pipe/RPC) klären. Das ist die Wake-Bridge VOM Paperclip-Server ZU meinem laufenden Prozess.
- Wenn die korrekte Konfig unbekannt: **User fragen**, nicht raten. Paperclip-CLI-Setup ist User-seitig.

**Why:** User-Korrektur 2026-05-29: "Nee, genau genommen bist du ein eigenständiger Prozess. Ich habe dich in der CLI gestartet und verbunden. Du kannst auf Paperclip zugreifen, weil ich dich darüber connected hätte." Plus: Adapter-Switch verursacht Identitäts-Sprawl und ist ein One-Way-Door, der schwer rückgängig zu machen ist, wenn schon Heartbeats gelaufen sind.

**How to apply:**
- Adapter-bezogene Reparatur-Versuche IMMER mit User abstimmen, bevor `adapterType` oder `adapterConfig` per PATCH geändert wird.
- Bei Diagnose-Output: nicht nur "was tut Paperclip mit dem Agent", sondern auch "wer bin ICH und welcher Prozess hostet mich" prüfen (PPID-Kette + Env-Inspection).
- Bei Verdacht auf adapter_failed: der Mechanismus VON Paperclip ZU mir ist der wahrscheinlichste Defekt — nicht die API-Verbindung VON mir ZU Paperclip, die offensichtlich funktioniert (sonst könnte ich nicht curlen).
