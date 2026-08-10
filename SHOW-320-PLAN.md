# SHOW-320 — UI adjustments to breakpoints · Umsetzungsplan

> Arbeitsdokument (lokal). Stand: laufende Grilling-Session. Nicht zwingend zum Commit gedacht.
> Branch: `feature/SHOW-320-breakpoints` (von `develop`) · Worktree: `showcase/worktrees/SHOW-320-breakpoints`

## 1. Kontext / Problem

Die UI stimmt an den „runden" Breiten (768 / 1024 / 1920), **bricht aber an Zwischenbreiten** (900 / 1300 / 1500). Kein Einzel-Bug, sondern systemisch:

- Breakpoint-Werte mehrfach **dupliziert** (CSS + 4 JS-Stellen).
- Container-/Content-Logik **inkonsistent** über die Seiten verteilt (`max-w-6xl` ~25×, dazu arbitrary `max-w-[…px]`).
- Der **md-Bereich (1024–1279)** ist unterversorgt (Komponenten springen `sm`→`lg`).

**Figma-SOLL** (Datei `TYdPJprCUxuqn564qa9urk`, Seite „ATOMS / Grid"): 5 Breakpoints — mobile 360 / tablet 768 · 1023 / desktop-min 992–1024 / desktop-max 1920. Content-Cap **1848** + **36px** Margin (lg), **16px** Margin (≤ md), Gutter **16 → 24**, Full-Bleed bis **2560**.

## 2. Getroffene Entscheidungen (Grilling)

| Thema | Entscheidung |
|---|---|
| Scope | Fundament **+ alle Kern-Templates** |
| md-Verhalten (1024–1279) | **Fluid** — Grid/Gutter an Figma angleichen, **kein** 992-Cap |
| Container-Mechanik | Tailwind **`@utility content-container`** (kein Wrapper-Component, kein Token-only) |
| Branch / Worktree | `feature/SHOW-320-breakpoints` von `develop`, unter `showcase/worktrees/` |
| Breakpoint-Quelle | CSS (`rem`) + TS (`px`) bleiben **zwei** Quellen — `getComputedStyle` scheidet aus (Tailwind v4 emittiert `--breakpoint-*` **nicht** als Runtime-Property → empirisch verifiziert: 0 Treffer im kompilierten CSS). Build-Script = Over-Engineering, **verworfen**. |
| Drift-Schutz | JS-Seite auf **eine** `breakpoints`-Konstante konsolidieren **+ Test-Guard** (parst `globals.css`, prüft `48rem==768`, `64rem==1024`, `80rem==1280`) |
| xl / 2xl | **Nicht** einführen (Figma hat nur 4 Stufen); wirkungslose `xl:`-Reste bereinigen |

## 3. Offene Punkte

- [x] **Container-Breite „1920 vs 1848"** — **geklärt (Arbeitsannahme):** kein Entweder-oder. 1920 = Frame/Außenbreite, 1848 = Content (`1920 − 2×36px Margin`). Token `--theme-container-6xl` **bleibt 1920**, die `@utility` liefert 1848 Content via `px-9`. Team-Tendenz (T. Schrader, Slack): 1920 ist die „richtige" Zahl; Ticket ebenso. **Design-Bestätigung (Vitalii) ausstehend — blockiert NICHT:** dank zentraler `@utility` ist eine spätere Korrektur eine 1-Zeilen-Änderung.
- [x] Gruppe-1/2-JS-Breakpoints (Sidebar↔Drawer, Tablet-Menü, Scroll-Lock, Observer, react-grid-layout): bleiben in JS (CSS kann das nicht) — bestätigt, kein CSS-Umbau.

## 4. Phasen

### Phase 1 — Breakpoint Single Source of Truth  *(entscheidungsreif)*
- `src/hooks/useBreakpoint.ts`: `export const breakpoints` = einzige JS-Quelle; **falschen JSDoc** („Standard Tailwind default") korrigieren.
- Ausreißer anbinden:
  - `src/hooks/ui/useElementScroll.ts:43` `window.innerWidth >= 1024` → `useBreakpoint('md')`.
  - `src/components/wishlist/wishlist-added-notification.tsx:23/36` `DESKTOP_ANCHOR_MIN_WIDTH` → zentrale Konstante / Hook.
  - `src/components/account/dashboard/dashboard.tsx:82` `breakpoints={{…}}` → `import { breakpoints }`.
- **Test-Guard** (Jest): `globals.css` `--breakpoint-*` (rem) ↔ `breakpoints` (px).
- Wirkungslose `xl:`-Reste: `create-return-dialog.tsx:161` (`xl:max-w-[1224px]`), `product-detail.tsx:424` (`xl-col-end-5` Tippfehler).

### Phase 2 — Container / Content `@utility`  *(hängt an offener Container-Entscheidung)*
- `@utility content-container` in `globals.css`: `max-width: var(--theme-container-6xl)` (1920) + `margin-inline:auto` + `px-4 lg:px-9` → Content 1848 / Margin 36.
- ~25× `max-w-6xl mx-auto px-4 lg:px-9` + arbitrary `max-w-[…px]` (hero 2500, compare 1848, quick-entry 1672, quote-dialog 1220 …) auf `content-container` / Tokens vereinheitlichen.
- `src/lib/utils.ts:220` `imageSizes` (`1200px`) → breakpoint-konform (768/1024/1280).

### Phase 3 — Kern-Templates angleichen
- **PDP** (`product-detail.tsx`, `product/[id]/page.tsx`): `lg:pr-38` (asymmetrisch) entfernen/angleichen; Sub-Grids konsistent (KeySpecs md-Stufe, Tech-Info 3er-Stufe); `xl-col-end-5`-Bug.
- **Quote/Account** (Ticket-Screenshot): md-Stufe in `quote-summary.tsx:26`; History-Grids `quote-details.tsx` responsiv; Sidebar-Schwelle `account-layout.tsx:41`.
- **Header / Footer / Cart / Checkout / Home** gegen Figma prüfen.
- **PLP** ist bereits Figma-treu (Referenz, nur Querchecks).

### Phase 4 — Validierung
- QA-Screenshots @ **768 / 900 / 1024 / 1300 / 1500 / 1920** (lokale App via Chrome/Playwright) gegen Figma-Frames; Abweichungen dokumentieren.

## 5. Referenzen
- Figma: „B2B New Showcase" `TYdPJprCUxuqn564qa9urk` · Grid-Seite `416-8805` · PDP `635-23879` · PLP `635-19791`.
- Jira: SHOW-320 (Schätzung 4–5 PT). PLP = Referenz-Implementierung, PDP = teils inkonsistent.
