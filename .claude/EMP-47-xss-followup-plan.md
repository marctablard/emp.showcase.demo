# EMP-47 Follow-up Plan — vollständige XSS-Sanitisierung an allen CMS-href-Senken

**Owner:** Architect (8d8dce6e) → reassign Frontend-Developer
**Ursprung:** Re-Review-Comment 750f4813 — Finding #1 (XSS) blieb unvollständig.
**Branch:** `feature/SHOW-323`, Baseline-Commit: `d568dbcd`

---

## 1. Problem-Statement

`sanitizeHref` ist in Commit `d568dbcd` nur an drei Stellen angewandt:
- `StoryblokCmsMapper.ts` (Integration-Boundary)
- `richtext.tsx`, `navigation-item.tsx` (Defense-in-depth in zwei UI-Komponenten)

**Lücke:** Weitere CMS-Renderer geben `link`/`href`-Felder direkt in `<a>` / `<Link>` / `<UiLink>` ohne Sanitisierung weiter. `javascript:`-URLs aus Storyblok-Daten landen damit am DOM. Zusätzlich liegen drei lokal divergente `sanitizeHref`-Implementierungen (Mapper: String-Präfix; navigation/richtext: RegEx) parallel — Drift-Risiko.

## 2. Architektur-Entscheidungen

### 2.1 Single source of truth: `src/lib/sanitize-href.ts`

- **Standort:** `src/lib/` ist neutraler Layer ohne `'use server'`/`'use client'`-Direktive — von `platform/integrations/**` UND `components/cms/**` importierbar. Vermeidet Schichten-Verstöße (kein Import aus `components/` in `platform/`).
- **Härtung gegenüber den drei bestehenden Variants:** `trim()` der Eingabe + `case-insensitive` Allowlist. Schützt zusätzlich gegen `\tjavascript:` und `JaVaScRiPt:`.
- **Null-Safety:** akzeptiert `string | null | undefined` und liefert `''` für non-strings.

### 2.2 Konsolidierung der bestehenden lokalen Implementierungen

Drei Variants ersetzen, eine Quelle behalten:
- `StoryblokCmsMapper.ts:178` (private method)
- `navigation-item.tsx:7-8`
- `richtext.tsx:6-7`

Alle importieren `sanitizeHref` aus `@/lib/sanitize-href`. Mapper-Aufruf am Boundary bleibt — nur die Implementierung wird zentralisiert.

### 2.3 Verantwortlichkeits-Vertrag

| Schicht | Aufgabe |
|---------|---------|
| Integration-Boundary (`StoryblokCmsMapper`) | Sanitisierung VOR dem Übergang externes Wire-Format → agnostisches `RichtextData`. Bleibt authoritativ. |
| CMS-Renderer (`button`, `content-block`, `quick-entry`, `top-banner-announcement`, `column-teaser-image`, `richtext`, `navigation-item`) | Defense-in-depth: sanitisiert vor jedem `href={...}` — auch für Quellen, die NICHT durch den Storyblok-Mapper laufen (z. B. lokal-JSON-CMS-Quelle). |
| `LocalJsonCmsAdapter` | Liefert bereits zod-validierte Daten — `sanitizeHref` ist dort nicht zwingend, aber die UI-Defense-in-depth fängt verbleibende Vektoren ab. |

## 3. Konkrete Call-Sites (vollständige Liste)

### 3.1 Neue Anwendungen (vom Re-Reviewer benannt)

| # | Datei | Zeile | Änderung |
|---|-------|-------|----------|
| 1 | `src/components/cms/button/button.tsx` | 20 | `href={sanitizeHref(link)}` |
| 2 | `src/components/cms/content-block/content-block.tsx` | 36, 69, 78 | `const buttonHref = sanitizeHref(button?.link); const isExternalButton = buttonHref.startsWith('http') || button?.is_external;` — Reihenfolge: erst sanitisieren, dann Extern-Heuristik daraus ableiten. |
| 3 | `src/components/cms/quick-entry/quick-entry-element.tsx` | 18 | `href={sanitizeHref(link)}` |
| 4 | `src/components/cms/top-banner-announcement/top-banner-announcement.tsx` | 24 | `href={sanitizeHref(link.url)}` |

### 3.2 Audit-Bonus (gleicher Vektor, gleicher Datenfluss)

| # | Datei | Zeile | Änderung |
|---|-------|-------|----------|
| 5 | `src/components/cms/column-teaser/column-teaser-image.tsx` | 40 | `href={sanitizeHref(image.link)}` — CMS-Daten, identisches Risikoprofil. |

### 3.3 Konsolidierung (Refactor — lokale Variants raus)

| # | Datei | Änderung |
|---|-------|----------|
| 6 | `src/components/cms/navigation/navigation-item.tsx` | Lokales `SAFE_HREF_RE` + `sanitizeHref` löschen. `import { sanitizeHref } from '@/lib/sanitize-href';` |
| 7 | `src/components/cms/richtext/richtext.tsx` | Lokales `SAFE_HREF_RE` + `sanitizeHref` löschen. `import { sanitizeHref } from '@/lib/sanitize-href';` |
| 8 | `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | `private sanitizeHref` (Zeile 178-190) löschen. `import { sanitizeHref } from '@/lib/sanitize-href';` Aufrufstelle (Zeile 136) bleibt — nur Quelle wechselt. |

## 4. Test-Strategy (für Testing-Engineer im Review-Gate)

### 4.1 Util-Unit-Tests (`src/lib/sanitize-href.test.ts`)

Pflicht-Matrix:
- **Allowlist:** `https://`, `http://`, `mailto:foo@bar`, `tel:+49…`, `/internal/page`, `#anchor` → unverändert zurück.
- **Blocklist:** `javascript:alert(1)`, `JaVaScRiPt:alert(1)`, ` javascript:alert(1)` (Leading-Space), `\tjavascript:alert(1)` (Leading-Tab), `data:text/html,…`, `vbscript:…`, `file:///…`, leerer String → `''`.
- **Edge:** `null`, `undefined`, Zahl, Objekt → `''`.

### 4.2 Component-Acceptance-Tests pro Senke

Pro neu-gesicherter Senke (#1–#5) ein Test: Render mit `link='javascript:alert(1)'` → resultierender DOM-Anchor hat `href=""`. Stellt sicher, dass das Util tatsächlich angerufen wird (kein vergessener Call).

### 4.3 Drift-Guard (Empfehlung — verhindert Regression)

ESLint-Custom-Rule ODER grep-basierter Test in `src/components/cms/**`: jede Datei mit `href={…}`/`href: …` in einer JSX-Position muss `sanitizeHref` importieren. Alternativ: Snapshot der Senkenliste im Test, der bei neuen Senken ohne Import bricht. **Optional** im ersten Wurf, **stark empfohlen** als Ratchet.

## 5. Verifikation (Definition of Done)

- [ ] Util-Tests grün (≥ 12 Cases)
- [ ] 5 neue Component-Tests grün
- [ ] Bestehende 155 Tests bleiben grün (Konsolidierung darf nichts brechen)
- [ ] `npm run lint` clean
- [ ] Manuelles Probe: in einer Storyblok-Demo-Story `link='javascript:alert(1)'` an einem `button`-Blok → DOM-Anchor hat `href=""`.

## 6. Risk-Beurteilung

- **Niedrig:** alle Änderungen sind lokale Edits in Renderer-Komponenten + ein neues Util. Keine API-/Schema-Änderung, keine Migration.
- **Schichten-Hygiene:** `src/lib/` ist explizit der neutrale Layer für solche Cross-Cutting-Utils — keine Verletzung der Integration→Service→React-Hierarchie.
- **Backwards-Compat:** unkritisch. Stories mit legitimen Links bleiben funktional; nur Stories mit `javascript:`/`data:`/`vbscript:` (= Angriffsmuster) bekommen leeren `href`.

## 7. Bekannte, akzeptierte Restlücke

`trim()` entfernt nur ASCII-Whitespace (`\s`). Ein Angreifer mit `​` (Zero-Width-Space) bekommt eine inerte URL, weil die Allowlist anschließend nicht mehr matched — also auch hier sicher. URL-decoded Tricks wie `%6avascript:` matchen ebenfalls nicht (kein Decode). **Keine offene Lücke.**

---

## Hand-off

**Implementierung an Frontend-Developer** (per Issue-Reassignment). Architect liefert das kanonische Util + Tests; Frontend-Developer wendet es an den 5 Call-Sites an und konsolidiert die 3 lokalen Variants. Testing-Engineer reviewt nach Implementation die Test-Coverage.
