# Slice 4 — StoryblokCmsAdapter (Storyblok hinter das Framework)

> **Branch**: feature/SHOW-323
> **Vorgänger**: Slice 3 merged (HEAD master = ec259a2-Merge)
> **Baseline**: 124 Suites / 1047 Tests (zum Drift-Check)
> **Modus**: Pro-Slice-Ablauf ohne User-CR (Decision 31). User-Final-Review nach Push.

## Goal

Storyblok-Pages laufen durch `CMSService → StoryblokCmsAdapter`. UI-Layer hat **keinen** `@storyblok/*`-Import mehr (außer im Adapter selbst). Article migriert auf agnostische `<Richtext>` via TipTap-Mapper.

## Scope (alle Files)

### Neu (Integration-Layer)

| Datei | Layer | Was |
|---|---|---|
| `src/platform/integrations/storyblok/cms/StoryblokCmsApi.d.ts` | Integration-API | Interface (SDK-Kapselung) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.ts` | Integration-Impl | `@injectable('StoryblokCmsApi')`, Lazy-Init des Storyblok-SDK, `getStory(slug, opts)`-Methode |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | Adapter | `@injectable('CmsAdapter:storyblok')`, implementiert `CmsAdapter`-SPI. `@inject('StoryblokCmsApi')` + `@inject('StoryblokCmsMapper')`. |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | Mapper | TipTap → agnostic Richtext AST. Plus: Storyblok-Page-Story-Response → `CMSPage`. |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.tsx` | UI/Bridge | Live-Preview-Bridge (ersetzt `StoryblokProvider`). |

### Tests neu

| Datei |
|---|
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.test.ts` (SDK gemockt) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` (Unit) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.contract.test.ts` (CmsAdapter-Contract-Suite) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.test.ts` (TipTap-Konvertierung pro Block + Inline) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.test.tsx` (RTL) |

### Geändert

| Datei | Änderung |
|---|---|
| `src/platform/services/cms/CmsProviderResolver.ts` | (kein Code-Change nötig — Provider-ID `storyblok` ist schon registriert) |
| `src/platform/depency.yml` | Adapter-Provider-Mapping ergänzt falls nötig |
| `src/components/cms/article/article.tsx` | `<RichtextStoryblok>` → `<Richtext>` (agnostisch); `content`-Schema auf `RichtextData` typed statt `z.unknown()` |
| `src/components/cms/article/schema.ts` | `content: z.unknown()` → `content: RichtextSchema.optional()` |
| `src/components/cms/article/article.test.tsx` | Test-Fixtures auf neue AST-Form anpassen |
| `src/app/[site]/[locale]/layout.tsx` | `StoryblokProvider` raus, ggf. `CMSService.BridgeScript` einbinden |

### Gelöscht

| Datei | Grund |
|---|---|
| `src/components/cms/richtext-storyblok.tsx` | Transitional Bridge — TipTap wird jetzt im Adapter-Mapper umgesetzt |
| `src/lib/storyblok.tsx` | Wrapper-Adapter + storyblokInit wandern in `StoryblokCmsApi` + Component-Map nutzt `cmsComponentMap` direkt |
| `src/components/cms/storyblok/storyblok-component.tsx` | Toter Code nach Pipeline-Umstellung (Slice 3 hat das schon vorbereitet) |
| `src/components/cms/storyblok/storyblok-cms-page.tsx` | Toter Code (Slice 3 hat Page-Route auf CMSService umgestellt) |
| `src/providers/StoryblokProvider.tsx` | Ersetzt durch `adapter.BridgeScript` |

## Verhalten-Constraints (Decision 23)

- Article-Render mit Richtext-Inhalt: visuell **1:1** zum Stand vor Slice 4. `<RichtextStoryblok>` und `<Richtext>` (nach Mapper-Konvertierung) müssen für die existierenden TipTap-Payloads identisches DOM produzieren.
- ENV-Switch `NEXT_PUBLIC_CMS_PROVIDER=storyblok` aktiviert den Adapter; mit gesetztem `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` rendert die Page Storyblok-Inhalt. Ohne Token: Fallback auf NullCmsAdapter wie heute.
- Visual Editor (Storyblok-Bridge) muss weiter funktionieren — `data-blok-*`-Attribute werden vom Adapter via `getEditableProps()` zurückgegeben, der Renderer spreaded sie.

## TipTap → AST Mapping (Mapper-Detail)

Storyblok-`StoryblokRichTextNode`-Block-Kinds → Richtext-AST:

| TipTap | Richtext-AST |
|---|---|
| `doc` → `content[]` | wrap-only, weitergeben |
| `paragraph` | `{ kind: 'paragraph', children: ... }` |
| `heading` mit `attrs.level` 1-6 | `{ kind: 'heading', level, children: ... }` |
| `bullet_list` | `{ kind: 'list', ordered: false, items: ... }` |
| `ordered_list` | `{ kind: 'list', ordered: true, items: ... }` |
| `list_item` | `{ kind: 'list-item', children: ... }` |
| `horizontal_rule` | `{ kind: 'hr' }` |
| `hard_break` | `{ kind: 'br' }` |
| `text` (mit optional `marks`) | `{ kind: 'text', text, marks: ['bold','italic',...] }` |

Schema-Cross-Check: das tatsächliche `RichtextSchema` aus `src/components/cms/richtext/schema.ts` ist der maßgebliche Vertrag. Mapper-Tests müssen für jede Block-Kind + Inline-Kind grün sein.

## Stop-and-Ask-Lagen (siehe Memory)

Architect ruft User für:
- `RichtextSchema`-Erweiterung, falls TipTap-Nodes existieren, die das aktuelle Schema nicht abbildet (z. B. `code_block`, `blockquote`, `link`-Mark)
- ENV-Variable für Storyblok-Multi-Site-Verhalten (falls neu)
- Bridge-Strategy: ob `BridgeScript` als globale Komponente im Root-Layout oder Per-Page eingebunden wird

## Quality Gates (alle 10 vor Push)

Siehe `.claude/agent-memory/architect/feedback_quality_gates_per_slice.md`. Spezifika für Slice 4:

- **Gate 6 (Browser-Smoke)**: testing-engineer testet
  - `NEXT_PUBLIC_CMS_PROVIDER=mock` (Mock-Adapter rendert wie in Slice 3)
  - `NEXT_PUBLIC_CMS_PROVIDER=storyblok` + Token (echter Storyblok-Render)
  - 0 Errors, 0 unerwartete Warnings in beiden Modes
- **Gate 8 (Verhaltens-Pinning)**: Article-Render mit altem TipTap-Payload muss visuell identisch zu Pre-Slice-4 sein (Snapshot-Vergleich oder DOM-Diff)
- **Test-Count-Erwartung**: 124 Suites + ~7-10 neue Suites (Adapter + Mapper + API + Bridge + Contract) → 131-134 Suites geplant

## Hand-off

1. testing-engineer Strategie-Modus → Test-Strategie pro File
2. testing-engineer Pre-Implementation-Modus → committet failing Akzeptanz-Tests
3. frontend-developer Build-Modus → implementiert iterativ pro File, Gates 1-4 grün pro Commit
4. Cross-Review-Loop (Architect + testing-engineer parallel, bis 0 Findings)
5. Architect Push + PR + Merge

## Lessons-Learned-Anhang (wird nach Slice-Done befüllt)

(leer)
