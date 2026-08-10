# SHOW-323 — Port-Plan v2 (Strategie E: Squash-Port)

> **Ersetzt** den ursprünglichen `SHOW-323-port-plan.md` (Strategie D — 180-Commit-Rebase).
> v1 bleibt als Archiv erhalten.

## 1. Warum v2

Strategie D (180 Commits commit-für-commit auf `develop` rebasen) wurde nach
Sub-Agent-Inventur als zu riskant verworfen:

- Showcase hat eine **alte/schmale Storyblok-Implementation**, die SHOW-323
  strukturell ersetzt (`src/components/cms/{hero,feature,…}.tsx` flach,
  `src/providers/StoryblokProvider.tsx`, `src/lib/storyblok.ts`,
  `src/platform/services/cms/impl/LocalCMSServiceSSR.ts`).
- Realistisch: 40–80 Konflikt-Runden statt 35 Files.
- Quell-Commit-Messages enthalten Slice-/SHOW-323-/RE-CUT-Codes → verletzt
  Memory-Regel `feedback_no_task_internals_in_code`.
- GitHub-PR-Review über 180 Commits / 303 Files unbrauchbar.

Strategie E (Squash-Port in 11 thematische Phasen) liefert:

- 11 Konflikt-Runden (1× pro Slice) statt 40–80.
- Saubere Commit-Messages ohne Task-Internals.
- Pro Slice ein eigener PR, einzeln reviewbar.
- Slice-Historie bleibt in `.claude/SHOW-323-slice-*.md` erhalten — der
  eigentliche Wahrheits-Ort.

## 2. Repos & Branches (Stand zum Port-Start)

| Rolle | Pfad | Branch | HEAD |
|---|---|---|---|
| Quelle (read-only) | `/Users/mhammer/Projekte/emporix/emporix-frontend.git` | `feature/SHOW-323` | `744bdb8` |
| Quelle-Basis | dito | `master` | `e23f7547` |
| Quell-Worktree (Inspektion) | `/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323` | — | — |
| Ziel-Bare | `/Users/mhammer/Projekte/emporix/showcase-bare` | `develop` (Default) | `cbdd1dbe` |
| Ziel-Worktree | `/Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323` | `feature/SHOW-323` | `cbdd1dbe` (leer auf develop) |

**`master` im showcase ist Legacy** (`5146e56a`, 1343 Commits divergent von
develop, "Add CODEOWNERS file"). Wird im Port nicht angefasst.

## 3. Branch-Topologie (passt Memory-Regel `feedback_branch_and_pr_workflow` an showcase an)

```
develop                       ← Default-Branch, unangetastet während Port
  └─ feature/SHOW-323-target  ← NEU, Akkumulations-Branch, Ziel aller Slice-PRs
       └─ feature/SHOW-323    ← existiert (leer), Arbeits-Branch
```

**PR-Regel:** alle Slice-PRs haben `head=feature/SHOW-323`,
`base=feature/SHOW-323-target`. Niemals direkt gegen `develop`.

**Memory-Anpassung:** Die generische Regel sagt "master" als Default-Branch —
im showcase ist das `develop`. Master in der Regel = Default-Integrations-Branch
des jeweiligen Repos.

## 4. Remote-Topologie (Port-Phase, User-Direktive)

| Remote | URL | Rolle während Port |
|---|---|---|
| `gitea` | `git@gitea-local:Emporix/emporix-showcase.git` | **Primär** — alle Slice-Pushes + alle PRs |
| `origin` | `git@github.com:emporix/emporix-showcase.git` | **Gesperrt** — kein Push, kein PR bis zum expliziten User-Go nach Letzt-Slice-Merge |

**Wenn der letzte Slice (Nach-Slice 10) auf `feature/SHOW-323-target` gemerged
ist und User explizit OK gibt, wird `feature/SHOW-323-target` einmalig nach
`origin` gepusht und ein einziger Aggregat-PR gegen `develop` eröffnet.** Bis
dahin ist origin-Push tabu.

## 5. Slice-Plan (11 Phasen)

| # | Slice | Kern-Wirkung | Plan-Datei | Konflikt-Fläche |
|---|---|---|---|---|
| 0 | Setup-Files | jest-config + setups + mocks/ + .env.template (Doku-only) | (neu) | klein, isoliert |
| 1 | Storyblok-Crash-Fix + Plugin-Foundation | `src/lib/storyblok.ts` Server-Only-Token, DI-Plugin-Bootstrap | `SHOW-323-slice-1.md` | mittel |
| 2 | Co-Location-Refactor | flache `cms/*.tsx` → Subdir-per-Block + showcase-only `local/`, `cms-component-renderer.tsx`, `banner-store.ts` löschen | `SHOW-323-slice-2.md` | groß |
| 3 | Adapter-Pipeline | `_core/`, `_shared/`, `cms-renderer.tsx`, `cms-page.tsx` | `SHOW-323-slice-3.md` | mittel |
| 4 | StoryblokServer-Removal + Provider-Entfernung | `storyblok/storyblok-{cms-page,component}.tsx`, `<StoryblokProvider>` aus Layout, `StoryblokProvider.tsx` löschen | `SHOW-323-slice-4.md` | mittel |
| 5 | Per-Site-Theming | `public/themes/*` + Site-Service-Anbindung | `SHOW-323-slice-5.md` | klein, additiv |
| 6 | Webhook + Cache-Invalidation | `app/api/cms/webhook/route.ts` + `revalidateTag` | `SHOW-323-slice-6.md` (+ 6.3, 6.3-recut, 6.4) | klein, additiv |
| 7 | Mock-CMS-Adapter | `MockCmsServiceSSR` + default-content fixtures | `SHOW-323-slice-7.md` | klein, additiv |
| 8 | Preview-Route + Middleware-Rewrite | `app/preview/[site]/[locale]/[[...slug]]/page.tsx`, `src/site/middleware.ts` `/preview/` Rewrite | `SHOW-323-slice-8-preview-route.md` | mittel (middleware-Touch) |
| 9 | Default-Fallback (Composite Adapter) | Composite wrapping primary + mock fallback | `SHOW-323-slice-9-default-fallback.md` | klein, additiv |
| 10 | Production-Smoke-Skript | `next build && next start` als npm-Script + CI-Hook | (neu) | klein |

**Setup-Vor-Slice (0)** ist technisch zwingend vor Slice 1 — sonst laufen
Slice-1-Tests gar nicht (fehlende jsdom-Polyfills, fehlende Mocks, fehlende
moduleNameMapper-Einträge).

**Nach-Slice 10** schließt die Memory-Regel `feedback_test_real_edge_runtime`
(Production-Build-Smoke als verbindliches Gate) ab.

## 6. Pro-Slice-Mechanik

Für jeden Slice (Vor-Slice 0 bis Nach-Slice 10):

1. **Pre-Slice-Disziplin** (Memory-Regel `feedback_quality_gates_per_slice`):
   - `MEMORY.md` lesen, einschlägige Regel-Dateien lesen.
   - Slice-Plan-Datei lesen.
2. **Files-Liste extrahieren** aus dem Slice-Plan. Falls die Liste lückenhaft
   ist (manche Slices haben sich beim Refactor erweitert), vergleichend
   `git -C /…/emporix-frontend.git diff --name-only <prev-slice-head>..<this-slice-head>`
   zum Schließen.
3. **Files aus Quelle holen** mit `git -C /…/showcase-bare checkout
   imported/SHOW-323 -- <files>` (nach einmaligem Fetch ins
   `imported/SHOW-323`-Ref).
4. **Konflikte auflösen** gegen showcase-Bestand (Mapping siehe Sektion 7).
5. **Tests grün** (`npm run jest -- <slice-scope>`).
6. **Build grün** (`npm run build`).
7. **Commit** mit generischer Message ohne Task-Internals (Memory-Regel
   `feedback_no_task_internals_in_code` — gegrept als Hard-Gate).
8. **Push** `feature/SHOW-323` nach `gitea` (nicht origin).
9. **PR eröffnen** in Gitea: `head=feature/SHOW-323`,
   `base=feature/SHOW-323-target`.
10. **Code-Review** durch testing-engineer + frontend-developer Cross-Review.
11. **Merge** in Gitea nach Review-Approval. Damit wird `feature/SHOW-323-target`
    um den Slice erweitert; `feature/SHOW-323` ist temporär 1 Commit hinter
    target → vor dem nächsten Slice rebasen oder mergen.

## 7. Konflikt-Mapping showcase ↔ SHOW-323

| Showcase (alt) | SHOW-323 (neu) | Aktion |
|---|---|---|
| `src/lib/storyblok.ts` | Adapter-Layer + Server-Only-Token | Ersetzen (Slice 1) |
| `src/providers/StoryblokProvider.tsx` | weg | Löschen (Slice 4) |
| `src/components/cms/*.tsx` (flach) | `cms/<name>/{index,schema,tsx,test}` | Migrieren (Slice 2) |
| `src/components/cms/cms-component-renderer.tsx` | `cms/_core/cms-renderer.tsx` | Löschen + Ersetzen (Slice 2→3) |
| `src/components/cms/local/local-cms-page.tsx` | `cms/_core/cms-page.tsx` | Löschen (Slice 2) |
| `src/components/cms/storyblok/storyblok-cms-page.tsx` | Adapter-internal | Löschen (Slice 4) |
| `src/components/cms/storyblok/storyblok-component.tsx` | Adapter-internal | Löschen (Slice 4) |
| `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` | `MockCmsServiceSSR` | Migrieren (Slice 7) |
| `src/stores/banner-store.ts` | weg (Banner via CMS-Adapter) | Löschen (Slice 2 oder 4) |
| `src/site/middleware.ts` | + `/preview/`-Rewrite | Erweitern (Slice 8) |
| `playwright.config.ts` | (frontend hatte stripped-down) | **showcase-Variante behalten** |
| `package.json` v1.3.0 | v1.4.0 + `eslint --fix` in lint-staged | Nach Slice 10 entscheiden |

## 8. ENV-Migration

| Showcase aktuell | SHOW-323-Ziel | Wirkung | Slice |
|---|---|---|---|
| `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (Client-Bundle exposed) | `STORYBLOK_ACCESS_TOKEN` (server-only) | **Fixt Token-Leak im Browser-Bundle** | Slice 1 |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` | weg → `/preview/`-Route + Server-Logik | Memory-Regel `feedback_no_global_env_for_per_request_state` | Slice 8 |
| `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` | weg | Adapter-internal | Slice 1 |
| — | `NEXT_PUBLIC_CMS_PROVIDER` (neu) | Adapter-Selektion | Slice 1 |
| — | `NEXT_PUBLIC_CMS_MOCK_DEFAULT_SITE` (neu) | Mock-Default | Slice 7 |
| — | `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock` (neu) | Composite-Fallback | Slice 9 |
| — | `NEXT_CMS_WEBHOOK_SECRET` (neu) | Webhook-HMAC | Slice 6 |

**Vor-Slice 0**: nur `.env.template` aktualisieren (Doku, keine echte
Code-Umstellung). Echte Server-Only-Umstellung des Tokens kommt mit Slice 1 —
bis dahin hat der User Zeit, das Token-Rename mit Ops/Deploy zu koordinieren.

## 9. Quality Gates pro Slice (Memory-Regel `feedback_quality_gates_per_slice`)

1. Pre-Slice-Disziplin (MEMORY.md + plan-File gelesen)
2. Slice-Files exakt nach Plan, keine ungeplanten Side-Edits
3. `npm run jest -- <scope>` grün
4. `npm run lint` grün
5. `npm run build` grün (Production-Build-Smoke ab Slice 8: zusätzlich `next start`)
6. `grep -rE "SHOW-323|Slice|RE-CUT|Pattern [A-Z]|DR-|PR-#" src/ docs/` = 0 Hits außer in `.claude/` und `docs/adr/`
7. Sub-Agent Cross-Review (frontend-developer + testing-engineer) = 0 Findings
8. Gitea-PR-Review = approved
9. Merge auf `feature/SHOW-323-target`
10. `feature/SHOW-323` rebased/synced auf neuen target-Stand vor nächstem Slice

## 10. Risiken & Annahmen

1. **`scripts/di-generator.ts`** wird in Slice 1 erweitert. Nach jedem Slice
   muss `npm run generate` laufen und `src/platform/{server,ssr,client}.ts`-Diff
   geprüft werden — sonst sind CMS-Adapter-Bindings still tot.
2. **package.json-Versionsmismatch** (showcase v1.3.0 ↔ frontend v1.4.0): wird
   nicht im Port mitgezogen, separate Entscheidung nach Letzt-Merge.
3. **Test-Daten / Tenants**: `auth-site-sync.spec.ts` env-Tenants müssen gegen
   showcase-Test-Tenants verifiziert werden (`main` ↔ Showcase, `us-branch`
   ↔ US). Falls Mismatch, im jeweiligen Slice E2E-Test anpassen.
4. **Origin-Drift während Port**: Falls auf GitHub `develop` während des Ports
   weiterläuft, muss `feature/SHOW-323-target` vor dem finalen origin-Push
   nochmal auf den neuen `develop`-Stand rebased werden.
5. **`imported/SHOW-323`-Ref im showcase-bare**: bleibt während des gesamten
   Ports erhalten, wird in Nach-Slice 10 gelöscht (`git -C /…/showcase-bare
   branch -D imported/SHOW-323`).

## 11. Status

- [x] Sub-Agent-Inventur (frontend-developer + testing-engineer)
- [x] Plan v2 geschrieben (diese Datei)
- [x] Gitea-Remote im showcase-bare angelegt
- [x] `master` + `develop` nach Gitea gepusht
- [ ] `feature/SHOW-323-target` von `develop` anlegen + Gitea-Push
- [ ] `feature/SHOW-323` (existiert leer) nach Gitea pushen
- [ ] `imported/SHOW-323`-Ref von emporix-frontend.git ins showcase-bare fetchen
- [ ] Vor-Slice 0: Setup-Files
- [ ] Slice 1–9
- [ ] Nach-Slice 10: Production-Smoke
- [ ] **User-Freigabe für Origin-Push abwarten**
- [ ] Letzt-Merge target → develop auf origin (single aggregate PR)
- [ ] Cleanup: `imported/SHOW-323` löschen, `ef-source`-Remote (falls angelegt) entfernen
