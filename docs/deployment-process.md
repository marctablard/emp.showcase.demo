# Deployment Process Documentation

This document describes the deployment process for the Emporix Showcase application, which uses Vercel for hosting and GitHub Actions for continuous integration and deployment.

## Table of Contents

- [Overview](#overview)
- [Vercel Configuration](#vercel-configuration)
- [GitHub Actions Workflows](#github-actions-workflows)
  - [PR Preview Workflow](#1-pr-preview-workflow-github-actions-deploy-pr-previewyml)
  - [Development Deployment](#2-development-deployment-github-actions-deploy-devyml)
  - [Staging Deployment](#3-staging-deployment-github-actions-deploy-stageyml)
  - [Production Deployment](#4-production-deployment-github-actions-deploy-prodyml)
- [Deployment Process Flow](#deployment-process-flow)
- [Environment Variables](#environment-variables)
- [Caching Strategy](#caching-strategy)
- [Health Checks](#health-checks)
- [Testing](#testing)
- [Vercel CLI](#vercel-cli)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)

## Overview

The Emporix Showcase application follows a multi-environment deployment strategy with four distinct environments:

1. **Preview Environment**: Temporary deployments for pull request reviews (URLs automatically assigned by Vercel)
2. **Development Environment**: Continuous deployment from the `develop` branch (URL automatically assigned by Vercel)
3. **Staging Environment**: Deployment from `release/**` branches (URL: https://showcase-stage.emporix.io)
4. **Production Environment**: Deployment triggered by version tags on the `master` branch (URL: https://showcase.emporix.io)

## Vercel Configuration

The application uses Vercel for hosting with different deployment environments:

- **Project Name**: `emporix-showcase`
- **Environments**:
  - **Production**: Main production environment (https://showcase.emporix.io)
  - **Staging**: Staging environment for pre-release testing (https://showcase-stage.emporix.io)
  - **Preview**: Automatically generated environments for development and pull requests

Vercel automatically assigns URLs for development and PR preview deployments.

## GitHub Actions Workflows

### SonarQube Scan (`sonarqube-scan.yml`)

**Purpose**: Runs static code analysis and security checks.

**Trigger**:
- Pushes to the `develop` branch
- Pull requests against the `develop` branch

**Process**:
1. Checks out the code (full history, `fetch-depth: 0`)
2. Runs the SonarQube scanner against an internal SonarQube host (`https://sonarqube.<internal-domain>`) using the `SONAR_LOGIN` secret and the `emporix-showcase` project key. On `pull_request` the action uses `sonar.pullrequest.*` so the quality gate is **new code vs the PR base** (`develop`). The job still runs on PRs to `develop` (same as before). Dependabot and forks are skipped. If `SONAR_LOGIN` is unset (a client checkout), the scan **step** no-ops so the job does not 401. Preview deploy does not run Sonar. This workflow is **internal only** — if packaged for external use, omit it or replace the host and project key.

Do not commit a local Sonar helper or run `sonarqube-scanner` for routine work. For obvious maintainability smells while editing, use SonarQube for IDE (see [testing-guide.md](./testing-guide.md#local-sonar-like-checks-no-upload)). That stays on the machine and does not upload a project analysis.

### 1. PR Preview Workflow (`github-actions-deploy-pr-preview.yml`)

**Purpose**: Creates preview deployments for pull requests.

**Trigger**:

- Pull requests against the `develop` branch
- Triggered on PR open or synchronize events

**Key Features**:

- Installs dependencies
- Runs lint checks
- Runs Jest tests
- Deploys to Vercel preview environment
- Preview URL is automatically assigned by Vercel

#### Reference Example

Below is a representative, self-contained example of the PR-preview workflow. It mirrors
what we actually run, but **all environment-specific and internal values are replaced with
placeholders** (see the `# CHANGE ME` comments). If you reuse this workflow, swap the
placeholders for your own values and store every secret in your GitHub repository/organization
settings — never commit real tokens, project IDs, internal hostnames, or tenant credentials.

```yaml
name: Deploy PR preview

on:
  pull_request:
    branches:
      - develop
    types:
      - opened
      - synchronize
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

env:
  # CHANGE ME: Vercel org/project identifiers — provide via GitHub secrets, do not hardcode.
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }} # CHANGE ME: your preview project's ID

jobs:
  build_and_deploy_pr_preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'
          cache-dependency-path: package-lock.json
      - name: Install Vercel CLI
        run: npm i -g vercel
      - name: Install dependencies
        run: npm ci
      - name: Run npm audit
        run: npm audit --audit-level=high
      # Playwright browsers install — uncomment to run E2E in CI.
      # - name: Install Playwright Browsers
      #   run: npx playwright install --with-deps
      - name: Pull Vercel environment information
        # CHANGE ME: VERCEL_TOKEN is a GitHub secret; never inline the token value.
        run: vercel env pull .env --environment=preview --yes --token=${{ secrets.VERCEL_TOKEN }}
      - name: Generate files
        run: npm run generate
      - name: Run lint
        run: npm run lint
      - name: Run jest
        run: npm run jest
        env:
          DOTENV_CONFIG_PATH: .env
          # CHANGE ME: point to your own API base URL.
          NEXT_PUBLIC_EMPORIX_BASE_URL: https://api.example.com
          # CHANGE ME: tenant-specific test credentials — supply via GitHub vars/secrets.
          NEXT_EMPORIX_TEST_TENANT: ${{ vars.NEXT_EMPORIX_TEST_TENANT }}
          NEXT_EMPORIX_TEST_CLIENT_ID: ${{ vars.NEXT_EMPORIX_TEST_CLIENT_ID }}
          NEXT_EMPORIX_TEST_CLIENT_SECRET: ${{ secrets.NEXT_EMPORIX_TEST_CLIENT_SECRET }}
          # CHANGE ME: integration-specific API key/collection — supply via GitHub vars/secrets.
          NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY: ${{ secrets.NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY }}
          NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION: ${{ vars.NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION }}
      # E2E run + report upload — uncomment together with the Playwright install step above.
      # - name: Run e2e
      #   run: npm run e2e
      # - name: Upload playwright report
      #   uses: actions/upload-artifact@v4
      #   if: ${{ !cancelled() }}
      #   with:
      #     name: playwright-report
      #     path: playwright-report/
      #     retention-days: 7
      - name: Deploy preview
        id: deploy
        run: |
          # CHANGE ME: VERCEL_TOKEN is a GitHub secret.
          DEPLOY_OUTPUT=$(vercel deploy --force --token=${{ secrets.VERCEL_TOKEN }})
          PREVIEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://.*vercel.app')
          echo "preview_url=$PREVIEW_URL" >> $GITHUB_OUTPUT
```

> **Note on internal-only workflows and hosts.** Some of our workflows reference
> internal infrastructure that must **not** be distributed as-is. For example, the SonarQube
> scan targets an internal host (`https://sonarqube.<internal-domain>` — CHANGE ME) using the
> `SONAR_LOGIN` secret. When packaging any workflow for external use, replace such internal
> hostnames and project keys with placeholders, or drop the workflow from the deliverable.

### 2. Development Deployment (`github-actions-deploy-dev.yml`)

**Purpose**: Deploys to the development environment.

**Trigger**:

- Push to the `develop` branch

**Key Features**:

- Installs dependencies
- Runs lint checks
- Runs Jest tests
- Deploys to Vercel preview environment
- URL is automatically assigned by Vercel

### 3. Staging Deployment (`github-actions-deploy-stage.yml`)

**Purpose**: Deploys to the staging environment.

**Trigger**:

- Push to `release/**` branches

**Key Features**:

- Installs dependencies
- Runs lint checks
- Runs Jest tests
- Deploys to Vercel staging environment
- URL: stage.emporix-showcase.vercel.app

### 4. Production Deployment (`github-actions-deploy-prod.yml`)

**Purpose**: Deploys to the production environment.

**Trigger**:

- Push of tags starting with `v` (e.g., v1.0.0)

**Key Features**:

- Installs dependencies
- Runs lint checks
- Runs Jest tests
- Deploys to Vercel production environment
- URL: emporix-showcase.vercel.app

## Deployment Process Flow

1. **Development Workflow**:

   - Developers work on feature branches
   - Create pull requests to `develop` branch
   - PR checks run automatically, creating preview deployments with Vercel
   - After PR approval and merge, the code is automatically deployed to the development environment

2. **Release Process**:

   - Create a `release/x.y.z` branch from `develop` when ready to release
   - This automatically triggers deployment to the staging environment (stage.emporix-showcase.vercel.app)
   - Test the application in the staging environment

3. **Production Release**:
   - After successful testing in staging, merge the release branch to `master`
   - Create and push a version tag (e.g., `v1.0.0`) on the `master` branch
   - This automatically triggers deployment to the production environment (emporix-showcase.vercel.app)

## Environment Variables

All workflows use environment variables that are managed through Vercel and GitHub:

- **Vercel Environment Variables**: Stored in the Vercel project settings for each environment (production, staging, preview)
- **GitHub Secrets**: Used in the GitHub Actions workflows
  - VERCEL_TOKEN: Authentication token for Vercel CLI
  - VERCEL_ORG_ID: Organization ID for Vercel
  - VERCEL_PROJECT_ID: Project ID for the Vercel project

During deployment, the Vercel CLI pulls the appropriate environment variables for each target environment:

```bash
vercel env pull .env --environment=[preview|stage|production] --token=${{ secrets.VERCEL_TOKEN }}
```

This ensures that the correct environment-specific variables are used for each deployment.

## Caching Strategy

All workflows implement caching for npm dependencies using GitHub Actions' built-in caching mechanism:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'npm'
    cache-dependency-path: package-lock.json
```

Additionally, Vercel provides its own build caching mechanisms to optimize deployment speed.

## Health Checks

For deployments to Azure, GCP, or Kubernetes, **dedicated health check endpoints** must be configured to prevent infinite API call loops. Health checks should **never** point to application routes like `/` or `/api/site`.

**Required Configuration**:
- **Liveness probe**: `/api/health`
- **Readiness probe**: `/api/ready`

See [Health Checks Documentation](./health-checks.md) for detailed configuration instructions for:
- Azure App Service
- Azure Container Apps
- Azure Kubernetes Service (AKS)
- Google Cloud Run
- Google Kubernetes Engine (GKE)

**⚠️ Critical**: If health checks are not properly configured, you may experience 36+ API calls per minute even with no user traffic, causing unnecessary load on Emporix APIs.

## Testing

All deployments include:

- Linting checks
- Jest unit tests

Playwright E2E tests are currently commented out in the workflows but can be enabled when needed.

## Vercel CLI

All workflows use the Vercel CLI to interact with Vercel's deployment platform. The CLI is installed in each workflow:

```yaml
- name: Install Vercel CLI
  run: npm i -g vercel
```

## Troubleshooting

If a deployment fails, check:

1. GitHub Actions logs for build or test failures
2. Vercel deployment logs in the Vercel dashboard
3. Environment variables configuration in Vercel
4. Vercel CLI version and authentication

## Future Improvements

Potential improvements to the deployment process:

1. Re-enable and enhance E2E testing with Playwright
2. Add automated smoke tests after deployment
3. Implement performance monitoring and alerting
4. Configure automatic rollback on failed deployments
5. Implement environment-specific approval workflows for production deployments
6. Set up domain aliases for easier access to environments

## Related Documentation

- [Documentation index](./README.md)
- [Health Checks](./health-checks.md)
- [Logging Guide](./logging-guide.md)
- [Run, Build & Deploy](./run-build-deploy.md)
