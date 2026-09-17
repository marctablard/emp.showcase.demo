# Emporix Showcase - Run, Build, Deploy Guide

This document consolidates how to run, build, and deploy the Emporix Showcase app and where to obtain required credentials. It is based on the repo docs and configuration in this workspace.

## What this app is (in brief)
- Next.js 16 App Router storefront with SSR, multi-site routing, and i18n (next-intl).
- Emporix platform integration for catalog, cart, checkout, customer, etc.
- Optional CMS (Storyblok) with a Local CMS fallback for development.
- Auth.js (NextAuth) with credentials and optional SSO providers.
- DI container generation (Inversify) required for builds.

## Prerequisites
- Node.js 22.x or 24.x (matches the `engines` field in `package.json`).
- npm (or yarn).
- Access to Emporix Developer Portal for API keys (see links below).
- Optional: Storyblok account and space (if using CMS in production).

## Quick local run (demo credentials)
This works out of the box using the demo values in `.env.template`.

1) Install dependencies
```
npm install
```

2) Create `.env` from template
```
cp .env.template .env
```

3) Start dev server (includes DI generator watch)
```
npm run dev
```

The app opens at `http://localhost:3000`.

## Local HTTPS Development (optional)

For testing with custom local domains (e.g., `vip-webshop.dev.local`) or features requiring HTTPS (like Storyblok Visual Editor), you can run the development server with HTTPS.

### Quick HTTPS (self-signed)

The simplest way to run with HTTPS:
```
npm run dev:https
```

This uses Next.js's built-in self-signed certificate. Your browser will show a security warning that you can bypass.

### Trusted HTTPS with mkcert (recommended for custom domains)

For a better experience with custom domains and no browser warnings:

1) Install mkcert

**macOS:**
```bash
brew install mkcert
mkcert -install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert
mkcert -install
```

**Windows (with Chocolatey):**
```powershell
choco install mkcert
mkcert -install
```

2) Generate certificates for your domains
```bash
mkdir -p .certificates
mkcert -key-file .certificates/localhost-key.pem \
       -cert-file .certificates/localhost.pem \
       localhost 127.0.0.1 ::1 \
       "*.dev.local" \
       vip-webshop.dev.local \
       at-webshop.dev.local
```

3) Add domains to /etc/hosts (if not already done)
```
127.0.0.1 vip-webshop.dev.local
127.0.0.1 at-webshop.dev.local
```

4) Run with custom certificates
```bash
npm run dev:https -- \
  --experimental-https-key .certificates/localhost-key.pem \
  --experimental-https-cert .certificates/localhost.pem
```

The app will be available at `https://vip-webshop.dev.local:3000` without browser warnings.

> **Note:** The `.certificates/` directory is gitignored. Certificates are valid for ~2 years and are local to your machine.

## Standard local run (with your own credentials)
1) Create `.env` from `.env.template`.
2) Replace the Emporix and Auth values (see "Required envs" below).
3) Run the app with `npm run dev`.

## Build and run production locally
1) Generate DI files + build
```
npm run build
```

2) Start production server
```
npm run start
```

## Testing (Jest)
Run the full Jest suite:
```
npm run jest
```

Integration tests are gated and will only run when:
- `RUN_INTEGRATION_TESTS=true` (or CI is true), and
- Emporix integration envs are set:
  - `NEXT_EMPORIX_TEST_TENANT`
  - `NEXT_EMPORIX_TEST_CLIENT_ID`
  - `NEXT_EMPORIX_TEST_CLIENT_SECRET`

BatteryIncluded search runtime credentials are not taken from storefront env vars. The server resolves BI `searchKey` and `indexName` from Emporix indexing provider `BATTERY_INCLUDED`, while `NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL` remains the BI API base URL.

## Local Clean-Install Parity Check (CI Dependency Parity)

`npm run jest` never reinstalls dependencies, so it cannot catch a broken lockfile, a dependency blocked by Aikido safe-chain (malware or safe-chain's own minimum package release-age policy), or a newly-disclosed high severity advisory. Validate that in isolation with:

```bash
npm run verify:ci-install
```

This runs [`scripts/verify-safe-chain-install.sh`](../scripts/verify-safe-chain-install.sh), which mirrors the dependency-install step used in `.github/workflows/*.yaml`:

1. Copies `package.json`, `package-lock.json`, and `.npmrc` into a disposable temp directory — your real `node_modules` is untouched.
2. Runs `safe-chain setup-ci` there first, then `npm ci --ignore-scripts` via `npx`, using the project's pinned npm version (`packageManager` in `package.json`) and safe-chain installed on-demand via `npx` only (never as a project/global dependency), matching CI's setup sequence while still enforcing safe-chain protections.
3. Runs `npm audit --audit-level=high` against the resulting lockfile.

This repo does not set npm's own `min-release-age` (see `.npmrc`); safe-chain still enforces its own, independently-controlled minimum release-age policy on top of malware blocking, both here and in CI. A freshly published dependency bump can therefore still be held back by safe-chain for a period after release even though plain `npm install` would resolve it — that is safe-chain working as intended, not a bug in this script or a reason to weaken it. A pass here only confirms today's lockfile clears safe-chain's policies and the audit; it is not a guarantee that a future bump of the same package will.

Scripts are skipped only because the disposable directory has no `.git` (the `prepare`/husky script requires one); it does not affect dependency resolution or the safe-chain/audit checks, but it does mean this check validates clean resolution, supply-chain policy, and audit only — it is not full lifecycle-script parity with CI, since CI's real `npm ci` runs install scripts and this one intentionally does not. Run this after any `package.json`/`package-lock.json` change, and never weaken it (lower `--audit-level`, skip safe-chain, or pin an old safe-chain release) to force a pass — a failure here means a real dependency issue that must be fixed or explicitly, visibly accepted.

### Preview-Only Safe-Chain Minimum-Package-Age Override

Two separate skips exist. Neither is a general safe-chain bypass.

**1. App lockfile (`npm ci`)** — standing preview exception, matching `npm run verify:ci-install:preview-override` (`SAFE_CHAIN_SKIP_MINIMUM_PACKAGE_AGE=1`):

- PR preview and develop preview always: `npm ci --safe-chain-skip-minimum-package-age`
- `smoke_prod` **only** when `github.event_name == pull_request`
- Production deploy (`github-actions-deploy-prod.yaml`) and non-PR smoke (`push` to `feature/**`, `workflow_dispatch`) keep plain `npm ci` with the full lockfile age gate

**2. Vercel CLI (`npm i -g vercel`)** — CLI-only exception, not the app lockfile:

- PR preview, develop preview, and `smoke_prod` (all events) skip age for the Vercel CLI install because that CLI currently pulls a too-new `@napi-rs/wasm-runtime`
- Production deploy does **not** pass this flag on `npm i -g vercel`

Scope of both skips — read carefully:
- They skip **only** safe-chain's minimum-package-age check.
- `safe-chain setup-ci` still runs first, and every other safe-chain protection (malware/dependency-confusion blocking) stays fully enforced.
- After `npm ci`, PR preview and `smoke_prod` run `npm audit --audit-level=high` through `scripts/verify-audit-policy.mjs`; develop preview runs the same `npm audit --audit-level=high` command directly. The age skip does not weaken that audit.
- The install step is a normal, non-`continue-on-error` step: any other install failure (network, integrity, malware block, unresolved dependency, etc.) still fails the job exactly as before.

This is a **standing preview-lane exception**, not a one-package time-box: preview/PR may install freshly published lockfile versions; production deploy must still wait for safe-chain's age window. Do not copy the `npm ci` skip onto production deploy.

To reproduce the preview lockfile install locally:

```bash
npm run verify:ci-install:preview-override
```

which is equivalent to `SAFE_CHAIN_SKIP_MINIMUM_PACKAGE_AGE=1 npm run verify:ci-install` and only ever skips the minimum-package-age gate — never the malware checks or the audit step.

### npm audit Policy Exceptions

The **Run npm audit** steps of `.github/workflows/github-actions-deploy-pr-preview.yaml` and `.github/workflows/github-actions-smoke-prod.yaml` still run the real, unmodified `npm audit --audit-level=high` — the audit level is never lowered, dev dependencies are never omitted, and `audit fix --force` is never used. What changed is how those steps decide pass/fail: instead of relying on `npm audit`'s own exit code, they capture its JSON report and pass it to [`scripts/verify-audit-policy.mjs`](../scripts/verify-audit-policy.mjs), which re-derives the pass/fail decision from the report content:

```yaml
- name: Run npm audit
  run: |
    npm audit --audit-level=high --json > audit-report.json || true
    node scripts/verify-audit-policy.mjs audit-report.json
```

`ALLOWED_EXCEPTIONS` currently holds a short-lived set (expires **2026-10-12**) for Next.js (`GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`), `sharp` (`GHSA-rgj7-g3m4-5g8c`), `js-yaml` (`GHSA-2883-xcg3-v3hh`), and `@tiptap/core` (`GHSA-j95f-988m-3j2f`). A hand-rewritten patched lockfile OOMed `npm ci` on GitHub runners, so the last installable lockfile stays in place until a generated lockfile can be committed. Do not extend `expires` without that lockfile.

High/critical `browserslist` advisories [`GHSA-c83g-rgw3-j3cx`](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) and [`GHSA-73wf-gq98-2v4g`](https://github.com/advisories/GHSA-73wf-gq98-2v4g) are fixed by pinning the patched `4.28.8` release via `overrides` in `package.json` (same pattern as `brace-expansion`). Do not add those GHSAs to `ALLOWED_EXCEPTIONS`. `browserslist@4.28.8` also pulls a too-new `electron-to-chromium` that safe-chain's minimum-package-age gate rejects on workflows that still run unmodified `npm ci` (production deploy, non-PR smoke, other branch deploys). Pin `electron-to-chromium` to the previously settled `1.5.389` until a newer release has aged in; then drop that override.

High/critical Next.js ([`GHSA-p293-qw3h-jr36`](https://github.com/advisories/GHSA-p293-qw3h-jr36), [`GHSA-2xp9-vwfh-vxw4`](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)), `sharp` ([`GHSA-rgj7-g3m4-5g8c`](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)), `js-yaml` ([`GHSA-2883-xcg3-v3hh`](https://github.com/advisories/GHSA-2883-xcg3-v3hh)), and `@tiptap/core` ([`GHSA-j95f-988m-3j2f`](https://github.com/advisories/GHSA-j95f-988m-3j2f)) advisories are temporarily excepted as above. Do not add a single-package `@tiptap/core` override (it breaks `@tiptap/pm` / extension peers). Remove the exceptions as soon as a generated lockfile with the patched releases installs under `npm ci`.

The mechanism exists to allow narrowly-scoped, time-boxed exceptions when a fix genuinely is not yet available, while keeping every other failure mode fatal. The active allowlist is the 2026-10-12 Next.js / `sharp` / `js-yaml` / `@tiptap/core` set above. The separately resolved historical `brace-expansion` entry is no longer in `ALLOWED_EXCEPTIONS`:

- **Advisory:** [`GHSA-mh99-v99m-4gvg`](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — `brace-expansion` DoS via unbounded expansion length (CWE-400/CWE-770), pulled in transitively through `minimatch` by the ESLint and Jest toolchains.
- **Resolved:** upstream published fixed patch releases on both affected major lines (`1.1.17` and `2.1.3`), so the advisory is fixed **without** the semver-major `eslint`/`jest` bump the exception was originally taken for. Both are pinned via `overrides` in `package.json` (`minimatch@^3.0.0 → brace-expansion 1.1.17` and `brace-expansion@^2.0.0 → 2.1.3`), and `npm audit --audit-level=high` now reports zero vulnerabilities. The entry was removed from `ALLOWED_EXCEPTIONS` per its own removal condition, ahead of its 2026-08-08 expiry.
- **Scope note:** `ALLOWED_EXCEPTIONS` is module-level in `scripts/verify-audit-policy.mjs`, so any future entry is honored by **every** workflow that runs that script: today PR preview and `smoke_prod`. Do not add an exception unless it is acceptable on both. Develop preview, production deploy, and the other named-env deploys run plain `npm audit --audit-level=high` with no allowlist. That asymmetry is why a tolerated advisory can be green on those script-backed jobs and still red on a branch/prod deploy — an exception buys time only where `verify-audit-policy.mjs` is the gate.

If a new exception ever becomes necessary, it MUST carry an explicit short-lived `expires` date, a written rationale, and `securitySignOff` (`ticket` + `recordedIn`, e.g. the approving PR). Do not add an unsigned exception. Remove the entry as soon as a real fix lands.

The current 2026-10-12 set is recorded on [PR 424](https://github.com/emporix/emporix-showcase/pull/424) / COP-5589 as a CI-gate-only relaxation (no runtime dependency versions changed). Merging that PR is the recorded sign-off for those five entries.

`scripts/verify-audit-policy.mjs` is deliberately strict about everything else:

- Any high/critical advisory **not** in `ALLOWED_EXCEPTIONS` fails CI.
- A missing, empty, unparsable, or unexpectedly-shaped audit report (e.g. a registry/network error instead of a real report) fails CI.
- Trailing npm/safe-chain notices after the first JSON object are ignored so a valid report is not rejected as malformed. The first object must still be a real audit report.
- It is robust to the two shapes `npm audit --json` uses inside each vulnerability's `via` array: a plain dependency-name string (transitive propagation through an already-reported package) versus an advisory object (an actual disclosed vulnerability, carrying its own `severity`/`url`/`title`). Only advisory objects are checked against the allowlist.
- Clock override (`--as-of=YYYY-MM-DD`) and the fixture allowlist (`--exceptions-json=...`) are accepted only under Jest (`JEST_WORKER_ID`). CI always uses the real UTC date and production `ALLOWED_EXCEPTIONS` so an expired exception cannot be backdated and tests cannot inject a fake allowlist.

To reproduce this exact CI check locally:

```bash
npm run verify:audit-policy
```

Do not weaken this mechanism to force a pass — do not add entries to `ALLOWED_EXCEPTIONS` without an expiry and a reviewed rationale, do not remove or extend the expiry check, do not add `continue-on-error` to the step, and do not lower `--audit-level` or add `--omit=dev`. A failure here means either a new high/critical advisory that must be triaged, or an exception has expired and needs a real fix or an explicit, reviewed renewal.

## Deployment (Vercel + GitHub Actions)
Deployment is automated using Vercel and GitHub Actions.

Environments:
- Preview: PRs to `develop`
- Development: pushes to `develop`
- Staging: pushes to `release/**`
- Production: tags on `master` starting with `v*`

GitHub Actions uses Vercel CLI and pulls env vars per environment. Required GitHub secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

See `docs/deployment-process.md` for workflow details.

## Required envs (minimum to run)
Use `.env.template` for a complete list and inline comments.

### Must-have for the app to boot
- `NEXTAUTH_SECRET` (Auth.js session encryption)
- `NEXT_PUBLIC_SERVER_URL` (local or deployed base URL)
- `NEXT_PUBLIC_EMPORIX_BASE_URL` (default `https://api.emporix.io`)
- `NEXT_PUBLIC_EMPORIX_TENANT` (your tenant name)
- `NEXT_PUBLIC_EMPORIX_CLIENT_ID` (Storefront API client id)
- `NEXT_EMPORIX_CLIENT_ID` (Server API client id)
- `NEXT_EMPORIX_CLIENT_SECRET` (Server API client secret)
- `NEXT_PUBLIC_DEFAULT_SITE`, `NEXT_PUBLIC_AVAILABLE_SITES` (site routing)
- `NEXT_PUBLIC_DEFAULT_LANGUAGE`, `NEXT_PUBLIC_DEFAULT_COUNTRY`, `NEXT_PUBLIC_DEFAULT_CURRENCY`

### Required for readiness probe (if you deploy with probes)
The `/api/ready` endpoint fails if any of these are missing:
- `NEXT_PUBLIC_EMPORIX_BASE_URL`
- `NEXT_PUBLIC_EMPORIX_TENANT`
- `NEXT_PUBLIC_EMPORIX_CLIENT_ID`

### Optional but common
- Storyblok
  - `NEXT_STORYBLOK_ACCESS_TOKEN`
  - `NEXT_STORYBLOK_MULTI_SITE`
  - `NEXT_STORYBLOK_ACCESS_PREVIEW`
- SSO
  - `NEXT_SSO_PASSWORD_SECRET`
  - Provider credentials (e.g. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Push notifications
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`
  - `NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS=true` to disable
- Setup API (use only if needed)
  - `NEXT_SETUP_API_SECRET`
  - `NEXT_SETUP_API_ENABLED=true`

## Where to get Emporix API keys
Emporix provides two primary key types per tenant:
- Emporix API (server-side, privileged)
- Storefront API (client-side, public)

Sources (Emporix docs):
- Manage API Keys: https://developer.emporix.io/ce/getting-started/developer-portal/manage-apikeys
- Creating your first tenant: https://developer.emporix.io/ce/getting-started/creating-a-tenant
- Emporix API quickstart: https://developer.emporix.io/api-references/quickstart/api-intro

Steps:
1) Log in to the Emporix Developer Portal.
2) Open your tenant.
3) Go to "Manage API Keys".
4) Copy Client ID and Secret for:
   - Storefront API (for `NEXT_PUBLIC_EMPORIX_CLIENT_ID`)
   - Emporix API (for `NEXT_EMPORIX_CLIENT_ID` + `NEXT_EMPORIX_CLIENT_SECRET`)

## Storyblok setup (optional CMS)
- Set `NEXT_STORYBLOK_ACCESS_TOKEN` in `.env`.
- For Visual Editor local use, run `npm run dev:https` (HTTPS required).
- Ensure your Storyblok space allows the dev/deployed domain.

See `docs/cms-framework.md` and `docs/local-cms.md`.

## Health checks (important for hosting)
- Liveness: `/api/health`
- Readiness: `/api/ready`

Do not point load balancers or probes at `/` or other routes, or it will trigger excessive Emporix API calls.

See `docs/health-checks.md`.

## Q&A: Cloud-specific (GCP, Azure, Vercel)

### GCP (Cloud Run vs GKE)
Q: Which one should we use?
A: Cloud Run is simpler for containerized Next.js with auto-scaling and managed HTTPS. GKE is better if you need full Kubernetes control, custom networking, or multi-service orchestration.

Q: What port does the app listen on?
A: `next start` listens on `3000` by default. Expose container port 3000 and route traffic to it.

Q: What should health checks target?
A: Use `/api/health` for liveness and `/api/ready` for readiness. Avoid `/` or page routes to prevent excessive Emporix API calls.

Q: What causes `/api/ready` to return 503?
A: Missing required envs: `NEXT_PUBLIC_EMPORIX_BASE_URL`, `NEXT_PUBLIC_EMPORIX_TENANT`, `NEXT_PUBLIC_EMPORIX_CLIENT_ID`.

Q: Do we need HTTPS for CMS editing?
A: Yes, Storyblok Visual Editor requires HTTPS. Cloud Run provides HTTPS by default; on GKE use an HTTPS ingress or gateway. Locally use `npm run dev:https`.

Q: Anything specific for Cloud Run?
A: Set the container port to 3000 and configure the health check path to `/api/health`. Keep env vars in Cloud Run service settings or Secret Manager.

Q: Anything specific for GKE?
A: Configure liveness/readiness probes to `/api/health` and `/api/ready` on port 3000. Ensure env vars are in ConfigMaps/Secrets and are mounted into the pod.

### Azure (App Service vs Container Apps vs AKS)
Q: Which one should we use?
A: App Service is simplest for web apps with minimal ops. Container Apps is ideal for containerized workloads with easy scaling and KEDA. AKS is for full Kubernetes control and complex multi-service setups.

Q: Which health check path should we configure?
A: `/api/health` for liveness and `/api/ready` for readiness. Do not use `/` or `/api/site`.

Q: Why do we see high API call volume in Azure?
A: Health checks pointing to app routes trigger SSR and Emporix calls. Fix by using `/api/health` and `/api/ready` only.

Q: What env configuration is required?
A: All required envs listed above. Ensure `NEXT_PUBLIC_SERVER_URL` matches the public hostname.

Q: What port should be exposed?
A: `3000` when using `next start`.

Q: Which HTTP version should Azure use?
A: Use HTTP/2 instead of Azure's default HTTP/1.1 where this is configurable. HTTP/1.1 can introduce unnecessary redirects in front of the app, while HTTP/2 avoids that extra redirect hop.

Q: Is readiness check safe if Emporix is down?
A: Yes. `/api/ready` checks only local env presence, not upstream services.

Q: Anything specific for App Service?
A: Configure the Health Check path to `/api/health` in App Service settings.

Q: Anything specific for Container Apps?
A: Configure liveness `/api/health` and readiness `/api/ready` probes in Container Apps; ensure the ingress port is 3000.

Q: Anything specific for AKS?
A: Configure liveness/readiness probes to `/api/health` and `/api/ready` in the pod spec, port 3000.

### Vercel
Q: How do deployments happen?
A: GitHub Actions deploy to Vercel based on branch/tag rules. Preview for PRs, dev for `develop`, staging for `release/**`, prod for `v*` tags on `master`.

Q: Where do env vars live?
A: Vercel project settings for each environment. GitHub Actions uses Vercel CLI to pull env vars during build.

Q: Which secrets are required in GitHub?
A: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Q: Does Vercel need a custom build command?
A: The repo uses `npm run build`, which runs DI generation + Next.js build + lint.

Q: How to debug a failed deploy?
A: Check GitHub Actions logs (build/test) and Vercel deployment logs. Common issues are missing env vars or invalid Emporix credentials. Ignore `npm warn deprecated …` during install — those are transitive notices and do not fail the job. Ignore `.git can't be found` from an older `prepare`/`husky` run: Vercel has no git worktree; `scripts/prepare-husky.cjs` skips husky when `.git` is absent. A real Vercel failure after `next build` that says `verify-client-chunks: missing …/.next/static/chunks` means the Next 16.3 immutable-assets layout (`.next/static/immutable/chunks`) was not scanned — that script now checks both paths.

## Troubleshooting checklist (common questions)
- App fails on startup: verify required envs and `.env` present.
- `/api/ready` returns 503: missing required envs.
- Login issues: check `NEXTAUTH_SECRET`, Emporix server API keys, and user exists.
- CMS content missing: verify Storyblok token or switch to Local CMS.
- SSO login fails: ensure `NEXT_SSO_PASSWORD_SECRET` is set and consistent across envs.
- Excessive API calls: verify health checks use `/api/health` and `/api/ready` only.

## References in this repo
- `.env.template` (all envs + notes)
- `docs/environment-variables.md`
- `docs/deployment-process.md`
- `docs/health-checks.md`
- `docs/cms-framework.md`
- `docs/sso-authentication.md`
- `docs/site-middleware.md`

## Related Documentation

- [Documentation index](./README.md)
- [Environment Variables](./environment-variables.md)
- [Deployment Process](./deployment-process.md)
- [Health Checks](./health-checks.md)
