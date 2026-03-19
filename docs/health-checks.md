# Health Check Endpoints

## Overview

This application provides dedicated health check endpoints (`/api/health` and `/api/ready`) to support Kubernetes liveness and readiness probes, as well as Azure/GCP health checks. These endpoints are **critical** for preventing infinite API call loops when health checks hit the application.

## Why These Endpoints Exist

### The Problem

When health checks (from Azure App Service, Kubernetes, or GCP Cloud Run) hit regular application routes like `/` or `/{site}/{locale}`, they trigger:

1. **Full Next.js layout initialization** - Server components execute
2. **Site data fetching** - `getSite()`, `getAvailableSites()` are called
3. **Emporix API calls** - Each site fetch triggers 5+ upstream API calls:
   - `getSite(code)` → `getCurrencies()`, `getCountries()`, `getRegions()`, `getPaymentModes()`
   - `getAvailableSites()` → calls `getSite()` for each configured site
4. **Token management** - Anonymous/customer token refresh attempts
5. **Cookie handling** - Health checks don't persist cookies, so each check looks like a new session

**Result**: With health checks running every 5-10 seconds, this creates ***N +API calls per minute** even when no users are using the application.

### The Solution

Dedicated health check endpoints that:
- ✅ Return immediately without executing layouts or server components
- ✅ Do **NOT** call any upstream services (Emporix APIs)
- ✅ Do **NOT** require authentication or cookies
- ✅ Are lightweight and fast (< 10ms response time)
- ✅ Can be safely called every few seconds without impact

In addition, the site middleware includes **probe detection** to protect expensive page routes when misconfigured health checks hit `/` or `/{site}/{locale}`. If a request looks like a probe (known probe user agents, empty UA, or `HEAD`), the middleware returns a lightweight `200 OK` response with:

- `Content-Type: text/plain; charset=utf-8`
- `Cache-Control: no-store`
- `x-misrouted-healthcheck: 1`
- `x-recommended-endpoint: /api/health`
- `x-alternative-endpoint: /api/ready`

## Available Endpoints

### `/api/health` - Liveness Probe

**Purpose**: Indicates the application process is running and responsive.

**Behavior**:
- Always returns `200 OK` if the server can respond
- No external dependencies checked
- Fast response (< 5ms typical)

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-13T10:30:00.000Z"
}
```

**Use Case**: Kubernetes/Azure liveness probes. If this fails, the container/pod should be restarted.

### `/api/ready` - Readiness Probe

**Purpose**: Indicates the application is ready to accept traffic (configuration is valid).

**Behavior**:
- Returns `200 OK` if required environment variables are present
- Returns `503 Service Unavailable` if critical configuration is missing
- Checks only **local configuration** (no upstream calls)

**Required Environment Variables** (sourced from `REQUIRED_ENV_VARS` in `src/platform/healthcheck/env-validation.ts`):
- `NEXT_PUBLIC_EMPORIX_BASE_URL`
- `NEXT_PUBLIC_EMPORIX_TENANT`
- `NEXT_PUBLIC_EMPORIX_CLIENT_ID`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_DEFAULT_CURRENCY`
- `NEXT_PUBLIC_DEFAULT_LANGUAGE`
- `NEXT_PUBLIC_DEFAULT_COUNTRY`
- `NEXT_PUBLIC_AVAILABLE_SITES`

**Success Response** (`200 OK`):
```json
{
  "status": "ready",
  "timestamp": "2026-01-13T10:30:00.000Z"
}
```

**Failure Response** (`503 Service Unavailable`):
```json
{
  "status": "not-ready",
  "missing": ["NEXT_PUBLIC_EMPORIX_TENANT"],
  "timestamp": "2026-01-13T10:30:00.000Z"
}
```

**Use Case**: Kubernetes/Azure readiness probes. If this fails, traffic should not be routed to the instance.

## Configuration

### Azure App Service

#### Using Azure Portal

1. Navigate to your App Service → **Settings** → **Health check**
2. Enable **Health check**
3. Set **Path** to `/api/health` for liveness
4. Set **Interval** to `30` seconds (recommended)
5. Set **Unhealthy threshold** to `3` consecutive failures

#### Using Azure CLI

```bash
az webapp config set \
  --resource-group <resource-group> \
  --name <app-service-name> \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

#### Using ARM Template / Bicep

```bicep
resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: appServiceName
  // ... other config
  properties: {
    healthCheckPath: '/api/health'
    // ... other properties
  }
}
```

#### Using Terraform

```hcl
resource "azurerm_linux_web_app" "app" {
  name                = "example-app"
  resource_group_name = azurerm_resource_group.example.name
  location            = azurerm_service_plan.example.location

  site_config {
    health_check_path = "/api/health"
  }
}
```

### Azure Container Apps

#### Using Azure Portal

1. Navigate to your Container App → **Settings** → **Health probes**
2. Add a **Liveness probe**:
   - **Path**: `/api/health`
   - **Port**: `80` (or your app port)
   - **Interval**: `30`
   - **Timeout**: `5`
   - **Failure threshold**: `3`
3. Add a **Readiness probe**:
   - **Path**: `/api/ready`
   - **Port**: `80`
   - **Interval**: `10`
   - **Timeout**: `5`
   - **Failure threshold**: `3`

#### Using Azure CLI

```bash
az containerapp update \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --liveness-probe-path /api/health \
  --liveness-probe-port 80 \
  --liveness-probe-interval 30 \
  --readiness-probe-path /api/ready \
  --readiness-probe-port 80 \
  --readiness-probe-interval 10
```

#### Using ARM Template / Bicep

```bicep
resource containerApp 'Microsoft.App/containerApps@2022-10-01' = {
  name: containerAppName
  properties: {
    configuration: {
      ingress: {
        // ... ingress config
      }
    }
    template: {
      containers: [
        {
          name: 'app'
          image: containerImage
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 80
              }
              initialDelaySeconds: 0
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/ready'
                port: 80
              }
              initialDelaySeconds: 0
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
    }
  }
}
```

### Azure Kubernetes Service (AKS)

#### Using kubectl

Create a deployment with health probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emporix-showcase
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: app
        image: your-registry/emporix-showcase:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
```

#### Using Helm Chart

```yaml
# values.yaml
deployment:
  containers:
    - name: app
      livenessProbe:
        httpGet:
          path: /api/health
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /api/ready
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
```

### Google Cloud Platform (GCP)

#### Cloud Run

##### Using gcloud CLI

```bash
gcloud run deploy emporix-showcase \
  --image gcr.io/PROJECT_ID/emporix-showcase:latest \
  --port 3000 \
  --health-check-path /api/health \
  --region us-central1
```

##### Using Cloud Run YAML

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: emporix-showcase
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/health-check-path: /api/health
    spec:
      containers:
      - image: gcr.io/PROJECT_ID/emporix-showcase:latest
        ports:
        - containerPort: 3000
        startupProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
```

#### Google Kubernetes Engine (GKE)

Same configuration as AKS (see Kubernetes section above):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: emporix-showcase
spec:
  template:
    spec:
      containers:
      - name: app
        image: gcr.io/PROJECT_ID/emporix-showcase:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
```

## Best Practices

### 1. **Never Point Health Checks at Application Routes**

❌ **DON'T**:
- `/` (root route)
- `/{site}/{locale}` (any page route)
- `/api/site` (application API routes)

✅ **DO**:
- `/api/health` (liveness)
- `/api/ready` (readiness)

Even with the middleware guard, always target the dedicated endpoints. The guard is a safety net, not a substitute for correct configuration.

### 2. **Configure Appropriate Intervals**

- **Liveness probe**: 5-30 seconds (more frequent, only checks if process is alive)
- **Readiness probe**: 30-60 seconds (less frequent, checks if ready for traffic)

### 3. **Set Reasonable Timeouts**

- **Timeout**: 5 seconds (health checks should be fast)
- **Failure threshold**: 3 consecutive failures before marking unhealthy

### 4. **Monitor Health Check Metrics**

Track:
- Health check response times (should be < 10ms)
- Health check failure rates
- Correlation between health check failures and application issues

### 5. **Don't Check Upstream Services in Readiness**

The `/api/ready` endpoint only checks **local configuration** (environment variables). It does **NOT** check:
- Emporix API connectivity
- Database connectivity
- External service availability

**Why?** If upstream services are down, your readiness probe would fail, causing Kubernetes/Azure to stop routing traffic to **all** instances, amplifying the outage.

## Troubleshooting

### Health Check Returns 503

**Symptom**: `/api/ready` returns `503 Service Unavailable`

**Possible Causes**:
1. Missing required environment variables
   - Check the response body for `missing` array
   - Verify all required env vars are set in your deployment configuration

2. Environment variables not loaded
   - In Azure: Check App Service Configuration → Application settings
   - In Kubernetes: Check ConfigMap/Secrets are mounted correctly
   - In GCP: Check Cloud Run environment variables or Secret Manager

**Solution**:
```bash
# Check what's missing
curl https://your-app.azurewebsites.net/api/ready

# Response will show:
# {"status":"not-ready","missing":["NEXT_PUBLIC_EMPORIX_TENANT"],...}
```

### Health Check Times Out

**Symptom**: Health checks timeout (> 5 seconds)

**Possible Causes**:
1. Application is overloaded
2. Network issues
3. Health check endpoint is hitting application routes (misconfiguration)

**Solution**:
- Verify health check path is `/api/health` or `/api/ready` (not `/` or other routes)
- Check application logs for slow requests
- Verify health check endpoint response time: `curl -w "@curl-format.txt" https://your-app/api/health`

### High API Call Volume Despite Health Checks

**Symptom**: Still seeing 36+ API calls/minute even with health checks configured

**Possible Causes**:
1. Health checks are still pointing to wrong routes
2. Multiple health check sources (Azure + Kubernetes + monitoring)
3. Client-side retry loops (see `useSite` hook)

**Solution**:
1. Verify health check configuration in Azure/K8s/GCP console
2. Check application logs for request paths:
   ```bash
   # Look for requests to /api/site or /{site}/{locale}
   # These should NOT be from health checks
   ```
3. Review `src/hooks/site/useSite.ts` for client-side retry logic

## Implementation Details

### Endpoint Characteristics

Both endpoints are configured with:

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

This ensures:
- No Next.js caching
- Always executes (not statically optimized)
- Fast response time

### Response Headers

Both endpoints set:
```
Cache-Control: no-store
```

This prevents any intermediate caches (CDN, proxy) from caching health check responses.

### Security Considerations

- Health check endpoints are **public** (no authentication required)
- They return minimal information (status + timestamp)
- No sensitive data is exposed
- Consider IP allowlisting if needed (though typically not required)

## Startup Configuration Validation

The application includes a two-tier configuration validation system that catches misconfigurations as early as possible.

### Tier 1 — Build-Time Env Var Validation

**When:** During `next build` (in `next.config.ts`)
**Behaviour:** Fails the build if required env vars are missing. Cannot be disabled.

**Required environment variables** (build fails if any are absent):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_EMPORIX_BASE_URL` | Emporix API base URL |
| `NEXT_PUBLIC_EMPORIX_TENANT` | Emporix tenant identifier |
| `NEXT_PUBLIC_EMPORIX_CLIENT_ID` | Emporix public/storefront client ID |
| `NEXTAUTH_SECRET` | NextAuth session encryption secret |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Default currency code |
| `NEXT_PUBLIC_DEFAULT_LANGUAGE` | Default language code |
| `NEXT_PUBLIC_DEFAULT_COUNTRY` | Default country code |
| `NEXT_PUBLIC_AVAILABLE_SITES` | Comma-separated list of available site codes |

**Optional environment variables** (build warns if absent):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_DEFAULT_SITE` | Default site code (resolved from `NEXT_PUBLIC_AVAILABLE_SITES[0]` if absent and turns off fallback to default site) |
| `NEXT_EMPORIX_CLIENT_ID` | Emporix server-side client ID |
| `NEXT_EMPORIX_CLIENT_SECRET` | Emporix server-side client secret |

**Example build failure output:**

```
[healthcheck] Missing required environment variables:
  ✗ NEXT_PUBLIC_EMPORIX_TENANT — missing (Emporix tenant identifier)
  ✗ NEXTAUTH_SECRET — missing (NextAuth session encryption secret)

Error: Build aborted: missing required environment variables. See errors above.
```

### Tier 2 — Runtime Startup Validation

**When:** At server startup (in `instrumentation.ts register()`)
**Behaviour:** Validates configured sites, currencies, and languages against the Emporix API. Site/currency/language mismatches are `'error'` severity and **block startup** via `process.exit(1)`. API unreachability degrades to `'warning'` severity and does **not** block startup (transient infrastructure issue, not a config error).

**Checks performed:**

1. Each configured site (`NEXT_PUBLIC_AVAILABLE_SITES`) exists in the Emporix tenant → `error` if missing
2. The default currency (`NEXT_PUBLIC_DEFAULT_CURRENCY`) exists in tenant currencies → `error` if missing
3. Each site's currency matches a tenant currency → `error` if mismatched
4. Each site's languages are present in the configured i18n locales → `error` if mismatched

> **Note:** If the Emporix API is unreachable during startup, all remote checks are skipped with a `warning`. This avoids blocking startup due to transient network issues or rolling deployments where the API may be temporarily unavailable.

**Toggle:** Set `NEXT_STARTUP_HEALTHCHECK_ENABLED=false` to disable Tier 2 checks. This only affects Tier 2 — Tier 1 (build-time) always runs.

**Example runtime log output (success):**

```
INFO: Configuration healthcheck starting...
INFO: ✓ Default currency "EUR" exists in tenant  { check: "currency:EUR" }
INFO: ✓ Site "main" exists in tenant  { check: "site:main" }
INFO: ✓ Site "main" currency "EUR" exists in tenant currencies  { check: "site:main:currency" }
INFO: ✓ Site "main" languages are all configured in i18n locales  { check: "site:main:languages" }
INFO: Configuration healthcheck completed: 4 passed, 0 errors  { passed: 4 }
```

**Example runtime log output (configuration error — blocks startup):**

```
INFO: Configuration healthcheck starting...
ERROR: ✗ Site "nonexistent" not found in Emporix tenant  { check: "site:nonexistent" }
FATAL: Configuration healthcheck failed with 1 error(s) — aborting startup  { errors: 1 }
```

**Example runtime log output (API unreachable — continues with warning):**

```
INFO: Configuration healthcheck starting...
WARN: Remote validation skipped: API unreachable (Network error)
WARN: Configuration healthcheck completed with warnings: 0 passed, 1 warning(s)  { warnings: 1 }
```

### Relationship to `/api/ready`

The `/api/ready` readiness probe shares the same `REQUIRED_ENV_VARS` constant as Tier 1. This ensures a single source of truth — any env var added to the build-time check is automatically included in the readiness probe.

## Related Documentation

- [Deployment Process](./deployment-process.md) - General deployment information
- [Environment Variables](./environment-variables.md) - Required environment variables
- [Site Middleware](./site-middleware.md) - How site routing works

## References

- [Kubernetes Liveness and Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Azure App Service Health Checks](https://learn.microsoft.com/en-us/azure/app-service/monitor-instance-health-check)
- [Azure Container Apps Health Probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [GCP Cloud Run Health Checks](https://cloud.google.com/run/docs/configuring/health-checks)
