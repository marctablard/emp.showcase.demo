---
name: no-global-env-for-per-request-state
description: HARTE Regel — Per-Request-State (Draft/Published, A/B-Variant, locale-Fallback, Preview-Mode etc.) NIE über globale ENV-Variablen steuern. Per-Request-Kontext gehört in den Request (searchParams / Cookies / Headers).
metadata:
  type: feedback
---

**Regel**: Wenn eine Eigenschaft pro Request anders sein soll (Preview vs. Public, Draft vs. Published, Variant A vs. B, Override-Locale, …), darf sie **niemals** über eine globale ENV-Variable resolved werden. Per-Request-State gehört in den Request — `searchParams`, Cookies, Header — und wird vom Service-/Adapter-Layer dort gelesen.

**Verbotenes Pattern**:
```typescript
// FALSCH — ENV macht aus dem Deployment einen entweder/oder-Modus
function resolveVersion(): 'draft' | 'published' {
  return process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW === 'true' ? 'draft' : 'published';
}
```

**Korrektes Pattern**:
```typescript
// RICHTIG — pro Request entschieden, Default = Public
function isPreview(searchParams?: Record<string, ...>): boolean {
  const v = searchParams?._storyblok;
  if (Array.isArray(v)) return v.some(x => !!x);
  return !!v;
}
// getPage(..., { searchParams }) + renderPage(ctx) nutzen denselben Helper → Konsistenz garantiert.
```

**Why:** User-Feedback 2026-05-22: *"Es kann ja nicht sein, dass die Environment-Variable darüber entscheidet, ob jetzt ein Draft angezeigt wird oder ob die Live-Seite angezeigt wird. Das muss über die Get-Parameter entschieden werden. Im Live-Editing muss ich natürlich den Draft-Stand anzeigen können und auf der Public-Seite den Public-Stand. Das kann ja nicht von der Environment-Variable abhängen."*

Konkreter Schaden im Branch: ein Deployment konnte entweder NUR draft oder NUR published ausliefern. Mischbetrieb (Public-Seite = published mit Caching, Editor-Iframe = draft ohne Caching) war unmöglich. Die ENV-driven `resolveVersion()` war ein Architektur-Bug, der mehrere Slices unbemerkt mitgetragen wurde, weil die Tests sie gepinnt haben statt sie zu hinterfragen.

**How to apply — verbindlich**:
1. **Im Plan-Review** (architect): jede neue ENV-Variable wird gefragt: *"Ist diese Eigenschaft per-Deployment konstant, oder kann sie pro Request anders sein?"* Wenn pro Request: ENV streichen, in den Request-Kontext (`searchParams`, Cookies, Header) verlegen.
2. **Im Test-Strategie-Review** (testing-engineer): Tests, die ENV-Mutation als "Preview-Verhalten" pinnen, sind ein **Anti-Pattern-Signal**. Die Strategie muss alarm schlagen, nicht das Anti-Pattern festschreiben.
3. **Im Adapter-Design** (architect + frontend-developer): per-Request-Entscheidungen (Preview, Variant, Locale-Override) → Helper im Adapter (`isPreview(searchParams)`, `resolveVariant(cookies)`), aufgerufen aus **allen** Adapter-Methoden, die denselben Kontext brauchen — gemeinsamer Helper sichert Konsistenz zwischen `getPage` / `renderPage` / …
4. **Cache-Konsequenz** ist Teil des Patterns: Public-Pfade tagged + cachable, Preview-Pfade `revalidate: 0` (bypass). Wenn ein Pfad per-Request beides sein kann, muss die Cache-Policy denselben Trigger nutzen wie die Daten-Wahl.

ENV-Variablen sind legitim für: Deploy-Konstanten (Tokens, Provider-IDs, URLs, Feature-Default-Flags ohne Per-Request-Dimension, Build-Toggles). Sobald eine Variable "pro Request" sein könnte, ist sie keine ENV mehr.

Gilt auch für Cookie- und Header-State, der heute fälschlich ENV-gesteuert ist — selbe Regel.
