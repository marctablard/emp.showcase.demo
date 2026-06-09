# Emporix Showcase - Run, Build, Deploy Guide

This document consolidates how to run, build, and deploy the Emporix Showcase app and where to obtain required credentials. It is based on the repo docs and configuration in this workspace.

## What this app is (in brief)
- Next.js 16 App Router storefront with SSR, multi-site routing, and i18n (next-intl).
- Emporix platform integration for catalog, cart, checkout, customer, etc.
- Optional CMS (Storyblok) with a Local CMS fallback for development.
- Auth.js (NextAuth) with credentials and optional SSO providers.
- DI container generation (Inversify) required for builds.

## Prerequisites
- Node.js 20+ (recommended by README).
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
- BatteryIncluded integration envs are set:
  - `NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY`
  - `NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION`

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
  - `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`
  - `NEXT_PUBLIC_STORYBLOK_MULTI_SITE`
  - `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW`
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
- Set `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` in `.env`.
- For Visual Editor local use, run `npm run dev:https` (HTTPS required).
- Ensure your Storyblok space allows the dev/deployed domain.

See `docs/storyblok-integration.md` and `docs/local-cms.md`.

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
A: Check GitHub Actions logs (build/test) and Vercel deployment logs. Common issues are missing env vars or invalid Emporix credentials.

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
- `docs/storyblok-integration.md`
- `docs/sso-authentication.md`
- `docs/site-middleware.md`
