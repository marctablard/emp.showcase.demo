# Slice 2 — Default-Komponenten-Foundation (Zod-Schemas + HTMLAttributes-Spread)

> **Parent**: [`SHOW-323-plan.md`](./SHOW-323-plan.md)
> **Vorgänger**: Slice 1 (PR #1, gemerged auf `feature/SHOW-323` Range `e23f754..081f522`)
> **Branch**: `feature/SHOW-323` (direkt drauf, alternativ Sub-Branch)

---

## 1. Goal

Default-Komponenten werden Adapter-ready:

- 20 Default-Komponenten ziehen aus `src/components/cms/<name>.tsx` (flach) in `src/components/cms/<name>/`-Ordner mit Co-Location-Pattern:
  - `schema.ts` (Zod, React-frei)
  - `<name>.tsx` (Component mit `HTMLAttributes`-Spread auf Root)
  - `<name>.test.tsx` (Spread-Test, Schema-Parse-Test)
  - `index.ts` (Re-Export der beiden)
- Globale `CMSComponentSchema` als `z.discriminatedUnion('type', [...])` in `src/components/cms/component-map.ts`.
- Globale `cmsComponentMap: Record<CmsComponentMapKey, { component, schema }>` als Vorbereitung für Slice 4.
- Domain-Type `CMSComponent` wird aus dem Discriminated Union abgeleitet (statt heutigem `{ id, type, [key: string]: any }`).
- Bestehende Caller funktionieren weiter durch `<name>/index.ts`-Re-Exports.

Plus Carry-Forward aus Slice 1:
- `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` löschen (Dead Code).
- `src/components/cms/local/local-cms-page.tsx` löschen (Dead Code).
- `BannerSchema` + Banner-Komponente (heute `top-banner-announcement.tsx`) wird im Cleanup in die normale Component-Map aufgenommen — die T6-Entscheidung "Banner ist normale CMS-Komponente" wird hier strukturell vorbereitet.

## 2. Out-of-Scope

- Renderer-Umbau auf `cmsComponentMap` → Slice 4.
- Adapter-seitige Validation via Schema → Slice 4.
- Storyblok-Wrapper-Komponenten löschen → Slice 4.
- Layout-Page-Konzept für Banner-Rendering → Slice 5.
- `cms-content.d.ts` der `CMSPage`/`CMSNoResult`-Types aufsplitten → später.

## 3. Komponenten-Inventar (20 Stück)

Aktuelle Files unter `src/components/cms/`:

| # | Name | Heutige Datei | Bemerkungen |
|---|---|---|---|
| 1 | article | `article.tsx` | — |
| 2 | button | `button.tsx` | exportiert heute `ButtonData`+`ButtonProps` separat; konsolidieren |
| 3 | category | `category.tsx` | — |
| 4 | column-teaser | `column-teaser.tsx` | wird von Storyblok-Wrapper genutzt |
| 5 | columns | `columns.tsx` | Container — nested `body[]` aus weiteren Components |
| 6 | content-block | `content-block.tsx` | — |
| 7 | feature | `feature.tsx` | — |
| 8 | grid | `grid.tsx` | Container — nested `columns[]` |
| 9 | hero | `hero.tsx` | wird von Storyblok-Wrapper genutzt; nutzt `TextEditorData` aus `hero.tsx` selbst (lokaler Type — in Schema überführen) |
| 10 | logo | `logo.tsx` | — |
| 11 | media-text | `media-text.tsx` | — |
| 12 | navigation | `navigation.tsx` | aufpassen: NICHT verwechseln mit `CMSNavigation`-Domain-Type aus Slice 1 (`model/cms/navigation.d.ts`); der ist Adapter-Output, das hier ist die Render-Komponente |
| 13 | page | `page.tsx` | Container — nested `body[]` |
| 14 | quick-entry | `quick-entry.tsx` | wird von Storyblok-Wrapper genutzt |
| 15 | recommendations | `recommendations.tsx` | wird von Storyblok-Wrapper genutzt |
| 16 | richtext | `richtext.tsx` | **Special-Case**: nutzt `StoryblokRichTextNode` aus `@storyblok/react/rsc`. Muss auf generischen `RichTextNode`-Type (TipTap/ProseMirror-kompatibel) umgestellt werden. |
| 17 | segment | `segment.tsx` | — |
| 18 | teaser | `teaser.tsx` | — |
| 19 | top-banner-announcement | `top-banner-announcement.tsx` | **T6-Sonderfall**: wird zur normalen CMS-Komponente. Schema-Name: `BannerSchema`, Type-Diskriminator-String: noch festzulegen — Vorschlag `'banner'` statt `'top-banner-announcement'` (saubererer Name, aber Storyblok-Mapper muss in Slice 4 das alte Naming auf das neue mappen). |
| 20 | video | `video.tsx` | — |

## 4. Schichten-Schnitt

### Neu (80 Files = 20 × 4)

Pro Komponente vier Files unter `src/components/cms/<name>/`:
- `schema.ts`
- `<name>.tsx`
- `<name>.test.tsx`
- `index.ts`

Plus übergreifend:
- `src/components/cms/component-map.ts` — Component-Map + Discriminated Union
- `src/components/cms/component-map.test.ts` — Vollständigkeits-Test (jeder `CMSComponent['type']` ist registriert)

### Geändert

- `src/platform/services/model/cms/cms-content.d.ts` — `CMSComponent` wird aus `@/components/cms/component-map` re-exportiert; alter `[key: string]: any`-Typ entfällt
- `src/lib/storyblok.ts` — Component-Imports auf `@/components/cms/<name>` (zeigt jetzt auf `index.ts`)
- `src/components/cms/storyblok/storyblok-component.tsx` — Imports auf neue Pfade
- `src/components/header/common/header-top-banner.tsx` — Import auf neue Pfade
- `src/components/cms/cms-component-renderer.tsx` — bleibt funktional, importiert dynamische Komponenten ggf. aus neuen Pfaden (map-basiert NOCH NICHT — das ist Slice 4)

### Gelöscht

- `src/components/cms/<name>.tsx` × 20 (alte flache Files — durch `<name>/index.ts`-Re-Export ersetzt)
- `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` (Dead Code aus Slice 1)
- `src/components/cms/local/local-cms-page.tsx` (Dead Code aus Slice 1)

## 5. Konvention für Schemas

**Hart durchgesetzte Regeln** (siehe Plan §6 im Master-Plan):

1. `schema.ts` darf nur `zod` und andere `schema.ts`-Dateien importieren. Kein React, kein Tailwind, kein UI.
2. Adapter (Slice 4 / Integration-Layer) importieren nur `*/schema` oder den `*/index`-Re-Export der Schemas. Niemals direkt `*.tsx`-Files.
3. Default-Komponenten-Vertrag (siehe Master-Plan §7):
   - Prop-Signatur = `<SchemaType> & HTMLAttributes<HTMLElement>`
   - `...rest`-Spread aufs **einzige** Root-Element
   - `className` via `cn(…)` mergen
   - **Keine** Fragment-Roots

### Beispiel-Skelett

```typescript
// src/components/cms/hero/schema.ts
import { z } from 'zod';

// Lokale Sub-Schemas (z.B. für TextEditorData) co-located oder shared
const TextEditorDataSchema = z.object({ /* … */ });

export const HeroSchema = z.object({
  id: z.string(),
  type: z.literal('hero'),
  headline: z.string(),
  text: TextEditorDataSchema,
  image: z.object({
    filename: z.string(),
    alt: z.string().optional(),
  }),
  main_button: z.array(ButtonDataSchema).optional(),
  video: z.array(VideoSchema).optional(),
});
export type HeroData = z.infer<typeof HeroSchema>;
```

```typescript
// src/components/cms/hero/hero.tsx
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import type { HeroData } from './schema';

type HeroProps = HeroData & HTMLAttributes<HTMLDivElement>;

const Hero = ({ id, type, headline, text, image, main_button, video, className, ...rest }: HeroProps) => {
  return (
    <div className={cn('relative mb-10 sm:mb-20 md:mb-10', '…', className)} {...rest}>
      {/* unveränderter Render-Inhalt */}
    </div>
  );
};

export default Hero;
```

```typescript
// src/components/cms/hero/index.ts
export { default } from './hero';
export * from './schema';
```

```typescript
// src/components/cms/hero/hero.test.tsx
import { render } from '@testing-library/react';
import { HeroSchema } from './schema';
import Hero from './hero';

describe('Hero', () => {
  describe('schema', () => {
    it('parses a valid hero component', () => {
      const parsed = HeroSchema.parse({ id: '1', type: 'hero', headline: 'X', text: { /* … */ }, image: { filename: 'x.png' } });
      expect(parsed.type).toBe('hero');
    });
    it('rejects invalid input', () => {
      expect(() => HeroSchema.parse({ id: '1', type: 'hero' })).toThrow();
    });
  });
  describe('component', () => {
    it('spreads root-level HTML attributes onto its root element', () => {
      const { container } = render(<Hero id="1" type="hero" headline="X" text={/*…*/} image={{filename:'x'}} data-test="hero-1" />);
      expect(container.firstChild).toHaveAttribute('data-test', 'hero-1');
    });
  });
});
```

## 6. Component-Map

```typescript
// src/components/cms/component-map.ts
import { z } from 'zod';
import Hero, { HeroSchema } from './hero';
import Button, { ButtonSchema } from './button';
// … alle 20

export const cmsComponentMap = {
  hero:                     { component: Hero,                schema: HeroSchema },
  button:                   { component: Button,              schema: ButtonSchema },
  'quick-entry':            { component: QuickEntry,          schema: QuickEntrySchema },
  // … alle 20
  banner:                   { component: TopBannerAnnouncement, schema: BannerSchema },  // T6
} as const;

export type CmsComponentMapKey = keyof typeof cmsComponentMap;
export type CmsComponentMap = typeof cmsComponentMap;

export const CMSComponentSchema = z.discriminatedUnion('type', [
  HeroSchema,
  ButtonSchema,
  QuickEntrySchema,
  // … alle 20
  BannerSchema,
]);
export type CMSComponent = z.infer<typeof CMSComponentSchema>;
```

**Vollständigkeitstest** (`component-map.test.ts`):
- Jeder Eintrag aus `cmsComponentMap` hat ein zugehöriges Schema in `CMSComponentSchema.options`.
- Jeder `type`-Literal aus `CMSComponentSchema.options` hat einen Component-Eintrag in `cmsComponentMap`.
- → Drift-Guard: man kann nicht ein Schema zur Union hinzufügen, ohne den Map-Eintrag, oder umgekehrt.

## 7. Domain-Modell-Anpassung

```typescript
// src/platform/services/model/cms/cms-content.d.ts
// vorher:
export interface CMSComponent {
  id: string;
  type: string;
  [key: string]: any;
}

// nachher:
export type { CMSComponent } from '@/components/cms/component-map';
```

`CMSPage` und `CMSNoResult` bleiben hier wie bisher.

**Schichten-Hinweis** (für Doku in Slice 7):
- Der Type-Re-Export aus `components/cms/component-map` ist build-zeit-only (nur `type`).
- Kein Runtime-Code aus UI-Layer in Domain-Layer.
- Wir behandeln `src/components/cms/` weiterhin als **Hybrid-Modul** (UI-Renderer + Domain-Sprache zwischen Adapter und App).

## 8. Special-Case: `richtext` (semantischer Block-AST, CMS-agnostisch)

Heute: `richtext.tsx` importiert `StoryblokRichTextNode` aus `@storyblok/react/rsc` und nutzt `BlockTypes`/`TextTypes`-Enums (TipTap-/Storyblok-Naming). Slice 2 entkoppelt vollständig — wir wählen einen **semantischen Block-AST** mit eigenständigen Element-Namen, der ausdrücklich nicht das TipTap-Modell nachbaut.

### Schema (Source of Truth)

```typescript
// src/components/cms/richtext/schema.ts
import { z } from 'zod';

const InlineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    value: z.string(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    code: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('link'),
    href: z.string(),
    text: z.string(),
  }),
]);

const BlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('heading'),
    level: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('paragraph'),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.array(InlineSchema)),
  }),
  z.object({
    kind: z.literal('image'),
    src: z.string(),
    alt: z.string().optional(),
  }),
  z.object({
    kind: z.literal('quote'),
    inlines: z.array(InlineSchema),
  }),
  z.object({
    kind: z.literal('code'),
    language: z.string().optional(),
    value: z.string(),
  }),
]);

export const RichtextSchema = z.object({
  id: z.string(),
  type: z.literal('richtext'),
  blocks: z.array(BlockSchema),
});

export type RichtextData = z.infer<typeof RichtextSchema>;
```

### Rendering

`richtext.tsx` enthält keine `@storyblok/*`-Imports mehr. Statt eines TipTap-Switches walked sie über `blocks` und delegiert pro `kind` an den passenden React-Element-Mapper:

```typescript
// src/components/cms/richtext/richtext.tsx
import type { HTMLAttributes } from 'react';
import type { RichtextData } from './schema';
import { cn } from '@/lib/utils';

export type RichtextProps = RichtextData & HTMLAttributes<HTMLDivElement>;

const Richtext = ({ id, type, blocks, className, ...rest }: RichtextProps) => {
  return (
    <div className={cn('richtext', className)} {...rest}>
      {blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
    </div>
  );
};

// BlockRenderer + InlineRenderer als interne, semantische switch-Bausteine
// (heading -> H1..H6, paragraph -> <p>, list -> <ol>/<ul>, …)

export default Richtext;
```

### Adapter-Konsequenz (Slice 4)

- **Storyblok-Adapter** muss TipTap-Tree → unser semantisches AST mappen. Walk durch `node.type/node.content`, ergibt einen Mapper von ~30-50 Zeilen.
- **Local-JSON-Adapter** (Michi's CMS) schreibt direkt das AST in seine `.json`-Files.
- **Contentful / Sanity** (zukünftig) mappen ihr Format analog in unser AST.

Damit ist `richtext` vollständig CMS-agnostisch und die Adapter-Schicht ist die einzige Stelle, die CMS-spezifische Rich-Text-Formate kennt.

### Coverage-Anmerkung

Das AST deckt die gängigen 90 %-Use-Cases ab (`heading`, `paragraph`, `list`, `image`, `quote`, `code`, plus Text-Marks und Links). Exotische Features (z. B. Storyblok-Embedded-Components in Rich-Text-Feldern, Sanity-Annotations) sind im AST nicht vorgesehen; der Adapter-Mapper kann sie entweder in ein passendes existierendes `kind` einsortieren oder ignorieren. Falls echtes Bedarf entsteht, ist der AST additiv erweiterbar (`kind: 'embed'` o. ä.) ohne Breaking Change.

## 9. Special-Case: Container-Komponenten

`columns`, `grid`, `page` haben `body`/`columns`-Felder, die wiederum CMS-Komponenten enthalten (rekursiv). Schemas:

```typescript
// in z.B. columns/schema.ts
import { z } from 'zod';

// Lazy-Reference auf CMSComponentSchema, da rekursiv
const ColumnsSchema: z.ZodType<ColumnsData> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.literal('columns'),
    columns: z.array(z.lazy(() => CMSComponentSchema)),
  })
);
type ColumnsData = {
  id: string;
  type: 'columns';
  columns: CMSComponent[];
};
export { ColumnsSchema };
export type { ColumnsData };
```

Tricky: Zirkuläre Imports zwischen `columns/schema.ts` ↔ `component-map.ts` (`CMSComponentSchema`). Lösung: `z.lazy()` auflöst zur Laufzeit, Imports auf Schema-Ebene durch Type-only-Imports. Falls zirkuläre Module trotzdem fehlschlagen, alternativ: `CMSComponentSchema` in einer eigenen `src/components/cms/component-schema.ts`-Datei, die nur die Discriminated Union enthält; `component-map.ts` importiert daraus.

Endgültige Auflösung beim Implementieren — Plan dokumentiert die Constraint.

## 10. Caller-Migrations

Bestehende Imports auf `@/components/cms/<name>` (top-level) müssen weiter funktionieren. Plan:

- `<name>.tsx` (alte Datei) löschen.
- `<name>/index.ts` (neue Datei) re-exportiert per `export { default } from './<name>';`.
- Module-Resolution: `import X from '@/components/cms/hero'` → `<name>/index.ts` → funktioniert.

Trotzdem alle Caller einmal auditieren:

- `src/lib/storyblok.ts` (18 Imports aus `@/components/cms/<name>`) — funktional unverändert
- `src/components/cms/storyblok/storyblok-component.tsx` (5 Imports) — funktional unverändert
- `src/components/header/common/header-top-banner.tsx` (1 Import) — funktional unverändert

Nach Slice 2 sollte `git grep "from '@/components/cms/[a-z-]*'"` weiterhin die gleichen Treffer liefern, alle resolvend.

## 11. Tests — Pflicht-Vertrag pro Komponente

Jede Komponente bekommt in ihrer `<name>.test.tsx`:

1. **Schema-Parse-Test**:
   - "parses a valid \<Component\> payload" (mit Minimal-Valid-Sample)
   - "rejects payloads missing required fields"
2. **Component-Spread-Test**:
   - "spreads `data-test` attribute onto root DOM element"
   - "merges className via cn() instead of overwriting"

Plus map-übergreifend:

- `component-map.test.ts`:
  - "every component-map key has a matching schema in CMSComponentSchema discriminated union"
  - "every type-literal in CMSComponentSchema has a matching map entry"

## 12. Akzeptanzkriterien Slice 2

- [ ] Alle 20 Komponenten in `src/components/cms/<name>/`-Co-Location-Struktur, alte flachen `<name>.tsx` gelöscht.
- [ ] Jede Komponente hat Zod-Schema, `HTMLAttributes`-Spread, `<name>.test.tsx`.
- [ ] `cmsComponentMap` enthält alle 20 Einträge (Drift-Guard-Tests grün).
- [ ] `CMSComponentSchema = z.discriminatedUnion(...)` mit allen 20 Schemas.
- [ ] `CMSComponent`-Domain-Type ist aus dem Discriminated Union abgeleitet.
- [ ] `richtext` ist von `@storyblok/react/rsc`-Imports befreit.
- [ ] `LocalCMSServiceSSR.ts` und `src/components/cms/local/local-cms-page.tsx` gelöscht.
- [ ] Bestehende Storyblok-Integration funktioniert (E2E `homepage.spec.ts` grün; Token-Setup vorausgesetzt).
- [ ] Alle Caller-Imports funktional (kein Build-Break).
- [ ] Lint, TS-strict, Jest, Build, `verify:client-chunks` grün.

## 13. Commit-Plan

Ziel: pro logische Einheit ein Commit, damit das CR übersichtlich bleibt.

1. `chore(cms): delete dead LocalCMSServiceSSR and cms/local routing` (Carry-Forward aus Slice 1, isoliert)
2. `feat(cms): introduce schema-first component map foundation` (Map-File mit leerer Map, CMSComponentSchema-Stub, Domain-Re-Export, Vollständigkeitstest mit Skip)
3. `feat(cms/<name>): co-locate component with zod schema and spread contract` × 20 (pro Komponente ein Commit — oder in 4er-Batches gruppiert, falls die Anzahl zu viel wird)
4. `refactor(cms): replace Storyblok richtext node type with generic schema` (Slice-2-Special-Case)
5. `feat(cms): register all components in the discriminated union` (Drift-Guard-Test aktiviert)
6. `refactor(cms): re-export CMSComponent type from component-map` (Domain-Anpassung)

**Granularität**: Wenn 20 einzelne Commits zu viel sind, batchen:
- Atom-Level (5): `button, logo, video, richtext, teaser`
- Molecule-Level (5): `hero, banner, quick-entry, content-block, column-teaser`
- Wide/Container (5): `page, columns, grid, navigation, recommendations`
- Domain (5): `article, category, segment, feature, media-text`

→ Ergibt **8-10 Commits** insgesamt.

## 14. Hand-off

1. `testing-engineer` (Strategie-Modus) — definiert Test-Files-Pflicht-Vertrag (Schema-Parse + Spread-Test + Map-Drift-Test). Bestätigt das `richtext`-Schema-Pattern.
2. `testing-engineer` (Pre-Implementation) — committed Stub-Test-Files für alle 20 Komponenten plus `component-map.test.ts` als initial failing/skipping.
3. `frontend-developer` (Build-Modus) — implementiert Co-Location, Schemas, Spread. In 8-10 Commits.
4. Cross-Review: architect (Schichten, `richtext`-Entkopplung, Container-Recursion) + testing-engineer (Coverage, Drift-Guard).
5. Push zu `gitea`.

## 15. Risiken

| Risiko | Mitigation |
|---|---|
| Zirkuläre Schema-Imports bei Container-Components (`columns`, `grid`, `page`) | `z.lazy()` + ggf. Trennung von `CMSComponentSchema` in eigene Datei |
| `richtext.tsx` interne Storyblok-Konstanten brauchen Replacement | Eigene `BlockTypes`-Konstanten in `richtext/` oder shared util |
| Storyblok-Wrapper-Komponenten (`StoryblokHero` etc.) brechen durch Path-Änderungen | Re-Export-Pattern (`<name>/index.ts`) garantiert Caller-Kompatibilität; Storyblok-E2E muss grün bleiben |
| `top-banner-announcement` → `banner` Rename-Risiko | Slice 2 entscheidet final über den Diskriminator-String — falls `'banner'` gewählt wird, muss Storyblok-Adapter (Slice 4) das alte Naming auf das neue mappen |
| Vollständigkeitstest in `component-map.test.ts` zu strikt? | Erlaubt nur 100%-Abdeckung — das ist gewollt, um Drift zu verhindern |


---

## 16. Bestätigte Plan-Entscheidungen (Diskussions-Outcomes)

| # | Frage | Entscheidung |
|---|---|---|
| **D1** | `top-banner-announcement` → `banner` rename? | **Bleibt `top-banner-announcement`.** Kein Storyblok-Mapping nötig. |
| **D2** | Footprint — alle 20 Komponenten in einem Slice? | **Walking Skeleton.** Slice 2 macht 5 Pilot-Komponenten + Foundation (Component Map, Discriminated Union, Domain-Re-Export). Slice 3 macht die restlichen 15. |
| **D3** | `richtext`-Entkopplung Tiefe | **Voll entkoppeln.** Eigener `RichTextNode`-Type, lokale `BlockTypes`-Konstanten, kein `@storyblok/react/rsc`-Import in `richtext/`. |
| **D4** | Quelle für `CMSComponent` Type-Re-Export | **`component-schema.ts` als reines Schema-Aggregat.** Importiert nur die `<name>/schema.ts`-Files (kein React, keine `.tsx`). `component-map.ts` importiert daraus + die Components. Domain re-exportiert `CMSComponent` aus `component-schema.ts` → kein UI-Touch im Domain-Re-Export. |
| **D5** | Storyblok-Wrappers (`StoryblokHero` etc.) in Slice 2 anfassen? | **Unangetastet.** Wrapper-`<div>` raus erst in Slice 4 (Storyblok-Adapter-Migration). Slice-Disziplin. |
| **D6** | Container-Schemas (`columns`/`grid`/`page`) Rekursion | **`z.lazy()` mit zirkulären Refs.** Falls Module-Resolution scheitert, Fallback auf `passthrough()`-Schema für Children — `frontend-developer` entscheidet pragmatisch bei Implementation. |
| **D7** | Naming-Konvention Schema-Type / Component-Props / Component | siehe §17 |

## 17. Naming-Konvention (verbindlich für alle 20 Komponenten)

Drei Identifier pro Komponente, eindeutig getrennt:

| Identifier | Was | File |
|---|---|---|
| `<Name>Schema` | Zod-Schema (Runtime + Validation) | `<name>/schema.ts` |
| `<Name>Data` | Schema-Output-Type (`z.infer<typeof <Name>Schema>`) — CMS-Datenmodell | `<name>/schema.ts` |
| `<Name>Props` | React-Component-Props = `<Name>Data & HTMLAttributes<…>` | `<name>/<name>.tsx` |
| `<Name>` | React-Komponente (default-export) | `<name>/<name>.tsx` |

**Beispiel — Hero**:

```typescript
// src/components/cms/hero/schema.ts
import { z } from 'zod';

export const HeroSchema = z.object({
  id: z.string(),
  type: z.literal('hero'),
  headline: z.string(),
  // ...
});
export type HeroData = z.infer<typeof HeroSchema>;
```

```typescript
// src/components/cms/hero/hero.tsx
import type { HTMLAttributes } from 'react';
import type { HeroData } from './schema';
import { cn } from '@/lib/utils';

export type HeroProps = HeroData & HTMLAttributes<HTMLDivElement>;

const Hero = ({ id, type, headline, className, ...rest }: HeroProps) => {
  return <div className={cn('…', className)} {...rest}>…</div>;
};

export default Hero;
```

```typescript
// src/components/cms/hero/index.ts
// Component (default) + Props-Type
export { default } from './hero';
export type { HeroProps } from './hero';
// Zod-Schema + Schema-Output-Type
export { HeroSchema } from './schema';
export type { HeroData } from './schema';
```

**Caller-Beispiele (kein Konflikt)**:
```typescript
import Hero from '@/components/cms/hero';                  // Component
import type { HeroData, HeroProps } from '@/components/cms/hero';  // Types
import { HeroSchema } from '@/components/cms/hero';        // Schema (Runtime)
```

Der Adapter-Mapper (Slice 4) nutzt:
```typescript
const data: HeroData = HeroSchema.parse(rawCmsBlok);  // typsicher
return <Hero {...data} {...adapter.getEditableProps?.(data)} />;
```

**Migrationsnotiz**: bestehende lokale Types wie `ButtonData`/`ButtonProps` in `button.tsx` werden in dieses Pattern überführt (`ButtonData` aus Schema, `ButtonProps` als `ButtonData & HTMLAttributes`). Doppelte Definitionen entfallen.

## 18. Aktualisierte Akzeptanzkriterien (Pflicht-Vertrag)

Jede der 20 Komponenten erfüllt:

- [ ] `<name>/schema.ts` exportiert `<Name>Schema` (Zod) und `<Name>Data` (Type).
- [ ] `<name>/<name>.tsx` exportiert `<Name>` (default, Component) und `<Name>Props` (Type).
- [ ] `<name>/index.ts` re-exportiert alle vier Identifier (`<Name>`, `<Name>Props`, `<Name>Schema`, `<Name>Data`).
- [ ] Component-Root spreaded `...rest`, merged `className` mit `cn(...)`.
- [ ] Test-File deckt Schema-Parse (valid + invalid) und Component-Spread (`data-test` auf Root) ab.

Plus übergreifend:

- [ ] `src/components/cms/component-schema.ts` exportiert `CMSComponentSchema` (Discriminated Union) und `CMSComponent` (Type).
- [ ] `src/components/cms/component-map.ts` exportiert `cmsComponentMap` (Component + Schema pro Eintrag) und `CmsComponentMap`/`CmsComponentMapKey` (Types).
- [ ] `component-map.test.ts` Drift-Guard: jede Map-Eintrag-Key ⇔ Diskriminator-Literal aus `CMSComponentSchema`.
- [ ] Domain `model/cms/cms-content.d.ts` re-exportiert `CMSComponent` aus `component-schema.ts`.
- [ ] `LocalCMSServiceSSR.ts` + `src/components/cms/local/local-cms-page.tsx` gelöscht.
- [ ] Bestehende Caller funktionieren weiter (Storyblok-Imports, Header-Banner-Import).
- [ ] Lint / TS-strict / Jest / Build / `verify:client-chunks` grün.


---

## 19. Walking-Skeleton-Konkretisierung (D2 = Variante B)

### Pilot-Komponenten in Slice 2

Fünf Komponenten — bewusst gewählt, damit alle Pattern-Variationen einmal durchgespielt sind:

| # | Komponente | Warum als Pilot |
|---|---|---|
| 1 | `button` | einfachstes Schema; löst die bestehende `ButtonData`/`ButtonProps`-Doppelung auf |
| 2 | `hero` | mittlere Schema-Komplexität (verschachtelte Image/Video/TextEditorData); Storyblok-Wrapper bestehend → Re-Export-Pattern wird verifiziert |
| 3 | `content-block` | typische Mid-Komplexität ohne Sonderfälle |
| 4 | `richtext` | Special-Case: semantischer Block-AST, kein `@storyblok/*`-Import (§8) |
| 5 | `page` | Container-Rekursion mit `z.lazy()` und `body[]`-Children (§9) |

### Foundation in Slice 2

Wird gebaut mit Drift-Guard auf die 5 Pilot — wenn Slice 3 weitere Komponenten registriert, läuft der Test mit.

- `src/components/cms/component-schema.ts` — `CMSComponentSchema = z.discriminatedUnion('type', [...])` mit den 5 Pilot-Schemas
- `src/components/cms/component-map.ts` — `cmsComponentMap` mit den 5 Pilot-Einträgen, `CmsComponentMap`/`CmsComponentMapKey`-Types
- `src/components/cms/component-map.test.ts` — Drift-Guard

### Out-of-Scope für Slice 2 (kommt in 2b)

Die übrigen 15 Komponenten:
`article, category, column-teaser, columns, feature, grid, logo, media-text, navigation, quick-entry, recommendations, segment, teaser, top-banner-announcement, video`

In Slice 3: alle in Co-Location-Pattern, jeweils mit Schema + Test + Spread-Vertrag, plus Register-Erweiterungen. Footprint dann ~60 Files, ~5-7 Commits.

### Dead-Code-Cleanup (Carry-Forward aus Slice 1, bleibt in Slice 2)

- `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` löschen
- `src/components/cms/local/local-cms-page.tsx` löschen

### Aktualisierter Commit-Plan (Slice 2)

1. `chore(cms): delete dead LocalCMSServiceSSR and cms/local routing`
2. `feat(cms): introduce component-map and component-schema foundation`
3. `feat(cms/button): co-locate with zod schema and spread contract`
4. `feat(cms/hero): co-locate with zod schema and spread contract`
5. `feat(cms/content-block): co-locate with zod schema and spread contract`
6. `refactor(cms/richtext): replace storyblok types with semantic block AST`
7. `feat(cms/page): co-locate with recursive zod schema and spread contract`
8. `feat(cms): register 5 pilot components in map + discriminated union`
9. `refactor(cms): re-export CMSComponent type from component-schema`

→ 9 Commits, deutlich überschaubarer als 12+ für Big Bang.
