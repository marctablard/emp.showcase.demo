# SHOW-323 — Portierung von emporix-frontend nach showcase

## Ausgangslage

SHOW-323 (CMS-Adapter-Framework + Per-Site-Theming + Webhook Cache + Preview Route)
wurde im Repo **emporix-frontend** komplett umgesetzt und ist dort fertig.
Sie soll nun auf das Repo **showcase** übertragen werden.

### Repos

| Rolle | Bare-Repo | Branch | HEAD |
|---|---|---|---|
| Quelle | `/Users/mhammer/Projekte/emporix/emporix-frontend.git` | `feature/SHOW-323` | `744bdb8` |
| Quelle-Worktree | `/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323` | — | — |
| Ziel | `/Users/mhammer/Projekte/emporix/showcase-bare` | `feature/SHOW-323` (neu, basiert auf `develop` @ `cbdd1dbe`) | — |
| Ziel-Worktree | `/Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323` | — | — |

### Wichtige Befunde

- **Keine gemeinsame Git-History** zwischen beiden Repos
  (`git merge-base showcase/master emporix-frontend/master` → leer).
- **Aber:** `showcase/develop` und `emporix-frontend/master` unterscheiden sich
  inhaltlich nur in **~35 Dateien**. Strukturell (z. B. `src/platform/`) sind
  beide Repos kompatibel.
- `feature/SHOW-323` basiert auf `emporix-frontend/master` (e23f7547) und
  enthält **~190 Commits**, **303 Dateien**, **+22.806 / -1.981 Zeilen**.
- Hauptsächlich betroffene Bereiche im Feature-Branch:
  - `src/components/` (158 Dateien)
  - `src/platform/` (91 Dateien) — existiert auch in showcase/develop
  - `src/app/` (10 Dateien)
  - `src/lib/`, `src/data/`, `jest/mocks/`, `public/themes/`

### Bekannte Divergenzen showcase/develop ↔ emporix-frontend/master

Nur in showcase/develop (werden durch develop-Basis erhalten bleiben):
- `.github/workflows/github-actions-deploy-*.yaml` (alle Deploy-Pipelines)
- `.github/CODEOWNERS`
- `playwright.config.ts` (existiert auch — Konflikt mit SHOW-323-Commit `092eb04` erwartet)
- `src/app/api/customer/current/password/route.ts`
- `src/platform/integrations/emporix/oauth/impl/EmporixOAuthApiClient.ts` (+ Test)
- `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.test.ts`
- `docs/environment-variables.md`, `RELEASE_NOTES.md` (kleinere Differenzen)

Modifiziert (potenzielle Konflikt-Hotspots beim Rebase):
- `package.json` (Versionsnummer)
- `package-lock.json`
- `.env.template`
- `src/components/account/account-layout.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/hooks/product/useProduct.ts`
- `src/i18n/translations/{de,en}/account/index.json`
- `src/i18n/translations/en/search/index.json`
- `src/lib/client/customer.ts`
- `src/lib/validation/form-schemas.{ts,test.ts}`
- `src/platform/depency.yml`
- `src/platform/integrations/emporix/common/impl/EmporixTokenManagerAbstract.ts`
- `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.ts`
- `src/platform/integrations/emporix/config/impl/EmporixConfigClient.ts`
- `scripts/di-generator.ts`
- `scripts/verify-client-chunks.mjs`

## Strategie: Option D — Branch importieren und auf `develop` rebasen

Idee: die ~190 SHOW-323-Commits als atomare Kette ins showcase-Repo holen
und in einem einzigen `git rebase --onto develop` auf die showcase-Basis
umstellen. Konflikte werden gebündelt gegen die ~35 oben aufgelisteten Files
auftreten.

### Schritte

#### 1. SHOW-323 + dessen Basis ins showcase-Repo fetchen

```bash
cd /Users/mhammer/Projekte/emporix/showcase-bare
git fetch /Users/mhammer/Projekte/emporix/emporix-frontend.git \
  feature/SHOW-323:refs/heads/imported/SHOW-323 \
  master:refs/heads/imported/emporix-master
```

Verifizieren:
```bash
git log --oneline imported/emporix-master..imported/SHOW-323 | wc -l   # ~190
git rev-parse imported/SHOW-323     # sollte 744bdb8... sein
git rev-parse imported/emporix-master  # sollte e23f7547... sein
```

#### 2. Worktree auf importierten Branch setzen

Der vorhandene Worktree-Branch `feature/SHOW-323` (basiert leer auf `develop`)
wird mit den importierten Commits überschrieben:

```bash
cd /Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323
git status                                # sollte clean sein
git reset --hard imported/SHOW-323
```

Jetzt enthält der Worktree exakt den Stand wie in emporix-frontend, basierend
auf emporix-master (nicht auf showcase/develop).

#### 3. Rebase auf showcase/develop

```bash
git rebase --onto develop imported/emporix-master feature/SHOW-323
```

Bedeutung:
- `--onto develop`: neue Basis = showcase/develop
- `imported/emporix-master`: alte Basis (Punkt, ab dem SHOW-323-Commits ausgewählt werden)
- `feature/SHOW-323`: zu rebasende Spitze

Erwartete Konflikte konzentriert in den oben aufgelisteten Dateien. Pro
Konflikt-Commit:
- **Versionsfiles** (`package.json`, `package-lock.json`): showcase-Version
  behalten, SHOW-323-Änderungen reinmergen wenn nötig (z. B. neue Dependencies).
- **showcase-spezifische Files** (`.github/workflows/*`, `playwright.config.ts`
  in der showcase-Variante, password-route, OAuth-Client): showcase-Version
  behalten, SHOW-323-Änderungen nur wo passend.
- **Komponenten-Refactorings** (account-layout, dialog, input, useProduct, ...):
  manuell entscheiden — Showcase-Branch ist meist die aktuellere Variante.
- **Platform-Files** (TokenManager, OAuthApiClient, ConfigClient): Showcase
  hat hier vermutlich die produktiv-erprobte Variante.

`playwright.config.ts` Sonderfall: SHOW-323-Commit `092eb04` fügt sie hinzu,
showcase hat aber bereits eine. → Bei dem Commit `git rebase --skip` oder
manuell mergen.

#### 4. Smoke-Tests im Worktree

```bash
cd /Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323
npm install
npm run typecheck       # exakter Skriptname aus package.json prüfen
npm run lint
npm run test
npm run build
```

Bei Test-Failures: viele SHOW-323-Tests sind Pre-Impl-/Contract-Tests gegen
neue CMS-Adapter-Schicht. Falls Imports fehlen, ist meist ein Konflikt-Merge
beim Rebase die Ursache.

#### 5. Cleanup

```bash
cd /Users/mhammer/Projekte/emporix/showcase-bare
git branch -D imported/SHOW-323 imported/emporix-master
```

Der finale `feature/SHOW-323`-Branch im showcase-Repo ist dann eigenständig
und nicht mehr auf das emporix-frontend-Repo angewiesen.

#### 6. Push (wenn Team grünes Licht gibt)

```bash
git push origin feature/SHOW-323
```

## Begleitende Übernahme: `.claude`-Ordner

**Bereits erledigt** (vor Session-Neustart):
Der `.claude/`-Ordner aus
`/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323/.claude/`
wurde komplett ins Ziel
(`/Users/mhammer/Projekte/emporix/showcase/worktrees/SHOW-323/.claude/`)
kopiert. Enthält:
- `SHOW-323-plan.md`, `SHOW-323-slice-{1..9}*.md`, `follow-up-stories.md`
- `agent-memory/`, `agents/`, `skills/`
- `settings.json`

## Risiken & Annahmen

1. **`develop ≠ emporix-master`** in einigen Files → Konflikte bei jedem
   Commit, der diese Files anfasst. Die Auflösung ist Files-by-File, keine
   Architektur-Entscheidung.
2. **DI-Container / `depency.yml`**: SHOW-323 fügt mehrere DI-Bindings hinzu.
   Falls `src/platform/depency.yml` in showcase abweicht, müssen die
   CMS-Adapter-Bindings manuell ergänzt werden.
3. **`scripts/di-generator.ts`**: SHOW-323 verändert dieses Script. Falls
   showcase eine andere Variante hat (siehe Diff oben), nach dem Rebase
   neu generieren: `npm run <generate-script>`.
4. **node_modules-Drift**: Nach Rebase ggf. `rm -rf node_modules && npm ci`.
5. **`.env.template`-Drift**: SHOW-323 fügt `NEXT_CMS_WEBHOOK_SECRET`,
   `STORYBLOK_ACCESS_TOKEN` (umbenannt von NEXT_PUBLIC_), `CMS_PROVIDER` hinzu.
   showcase-Version übernehmen + diese Einträge ergänzen.

## Status

- [x] `.claude/` aus Quell-Worktree übernommen
- [x] Übertragungsplan geschrieben (diese Datei)
- [ ] **Session-Neustart mit Team des emporix-frontend-Projekts**
- [ ] Schritt 1: Fetch
- [ ] Schritt 2: Worktree-Reset
- [ ] Schritt 3: Rebase auf develop
- [ ] Schritt 4: Smoke-Tests
- [ ] Schritt 5: Cleanup
- [ ] Schritt 6: Push (nach Freigabe)
