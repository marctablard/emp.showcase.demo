---
name: feedback-show323-storyblok-directly-registered-components
description: SHOW-323 — `lib/storyblok.ts` registriert manche Components direkt (content_block, page) statt via Wrapper; Prop-Shape-Migration bricht Runtime aber nicht Build.
metadata:
  type: feedback
---

`src/lib/storyblok.ts` hat ZWEI Patterns:
1. **Wrapped** (Hero, Button, QuickEntry, ColumnTeaser, Recommendations) — über `StoryblokHero`/`StoryblokButton`/... in `storyblok-component.tsx`, die `<Hero {...blok} />` spreaden.
2. **Direct** (ContentBlock, Page, Feature, Teaser, Grid, Columns, Logo, Navigation, Category, Segment, Article, MediaText, Video, TopBannerAnnouncement) — direkt registriert; Storyblok SDK ruft `<ContentBlock blok={blok} />`.

Slice 2 ändert Direct-Components von `{blok: {...}}`-Prop auf flat `<Name>Data & HTMLAttributes`. Die Direct-Registrierungen in `lib/storyblok.ts` (Page, ContentBlock für Slice 2; rest für Slice 3) passieren raw blok als id-Prop -> Runtime breakage auf Storyblok-fed pages.

Build ist OK (Storyblok-SDK typed mit `React.ElementType` = `any`). Lint OK. Jest OK (eigene Specs verwenden flat-shape).

**Why:** Slice 4 ist der Storyblok-Adapter-Migration-Slice; bis dahin "Storyblok-Wrappers unangetastet" (D5). Konsequenz: Slice 2/3-Komponenten in Direct-Registrierung haben Storyblok-Runtime-Regression bis Slice 4 liefert.

**How to apply:** Bei Slice-3-Migration NICHT überraschen, wenn E2E auf Storyblok-fed pages mit content-block/page/feature/etc. Empty rendert. Architect entscheidet bei Bedarf: (a) Shim-Wrapper in `storyblok-component.tsx` hinzufügen (kostengünstig), oder (b) als bekannte Slice-4-Aufgabe stehen lassen.

Pilot-Wrappers (Slice 2): Button + Hero sind weiter wrapped -> unverändertes Runtime-Verhalten. ContentBlock + Page + Richtext sind die Risiko-Komponenten.

Siehe Slice-2-Spec D5: "Wrapper-div raus erst in Slice 4".
