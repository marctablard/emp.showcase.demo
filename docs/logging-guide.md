# Logging Guide

This guide explains how to use the PINO logger throughout the Emporix Showcase application.

## Overview

The application uses [PINO](https://getpino.io/) for structured JSON logging. PINO is a low-overhead, high-performance logger designed for Node.js applications with excellent Next.js integration.

## Log Levels

PINO supports the following log levels (in order of severity):

| Level   | Value | Description                              | Usage                                |
| ------- | ----- | ---------------------------------------- | ------------------------------------ |
| `trace` | 10    | Most verbose, detailed debugging info   | Deep debugging, rarely needed        |
| `debug` | 20    | Development debugging information        | Development-only debugging           |
| `info`  | 30    | General informational messages           | Standard operations, milestones      |
| `warn`  | 40    | Warning messages                         | Potential issues, recoverable errors |
| `error` | 50    | Error messages                           | Failures, exceptions                 |
| `fatal` | 60    | Critical errors that stop the app        | Catastrophic failures                |

## Environment Configuration

### Server-side Logging

| Variable           | Default (Dev) | Default (Prod) | Description                    |
| ------------------ | ------------- | -------------- | ------------------------------ |
| `NEXT_LOG_LEVEL`   | `debug`       | `info`         | Minimum log level for server   |

### Client-side Logging

| Variable                   | Default (Dev) | Default (Prod) | Description                    |
| -------------------------- | ------------- | -------------- | ------------------------------ |
| `NEXT_PUBLIC_LOG_LEVEL`    | `debug`       | `warn`         | Minimum log level for browser  |
| `NEXT_PUBLIC_LOG_ENABLED`  | `true`        | `true`         | Enable/disable client logging  |

### Example .env Configuration

```bash
# Development
NODE_ENV=development
NEXT_LOG_LEVEL=debug
NEXT_PUBLIC_LOG_LEVEL=debug
NEXT_PUBLIC_LOG_ENABLED=true

# Production
NODE_ENV=production
NEXT_LOG_LEVEL=info
NEXT_PUBLIC_LOG_LEVEL=warn
NEXT_PUBLIC_LOG_ENABLED=true
```

## Usage Examples

### 1. API Routes (Server-side)

Use the `LoggerService` from the server DI container in API routes:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET(request: NextRequest) {
  try {
    // Your business logic here
    const result = await someOperation();

    return NextResponse.json(result);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: request.nextUrl.pathname,
        method: 'GET',
      },
      'Request failed',
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. React Components (Client-side)

Use the `useLogger` hook in React components:

```typescript
'use client';

import { useLogger } from '@/hooks/common/useLogger';

export function MyComponent() {
  const logger = useLogger();

  const handleClick = () => {
    logger.info({ component: 'MyComponent' }, 'Button clicked');
  };

  const handleError = (error: Error) => {
    logger.error(
      { component: 'MyComponent', error: error.message },
      'Component error',
    );
  };

  return (
    <button onClick={handleClick}>Click Me</button>
  );
}
```

### 3. Custom React Hooks

Use the `useLogger` hook within custom hooks:

```typescript
'use client';

import { useLogger } from '@/hooks/common/useLogger';
import { useState, useEffect } from 'react';

export function useCustomData(id: string) {
  const logger = useLogger();
  const [data, setData] = useState(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    logger.debug({ id }, 'Fetching data');

    fetch(`/api/data/${id}`)
      .then(res => res.json())
      .then(data => {
        logger.info({ id }, 'Data fetched successfully');
        setData(data);
      })
      .catch(err => {
        logger.error({ id, error: err.message }, 'Failed to fetch data');
        setError(err);
      });
  }, [id, logger]);

  return { data, error };
}
```

### 4. Client Library Files

Use the `getLogger` utility in non-component client code (utilities, stores, etc.):

```typescript
// src/lib/client/my-service.ts
'use client';

import { getLogger } from '@/lib/logger/use-logger-client';

export async function fetchData(endpoint: string) {
  const logger = getLogger();

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      logger.warn({ endpoint, status: response.status }, 'API request failed');
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    logger.error(
      { endpoint, error: error instanceof Error ? error.message : String(error) },
      'API request error',
    );
    throw error;
  }
}
```

### 5. Zustand Stores

Use the `getLogger` utility in Zustand stores:

```typescript
'use client';

import { create } from 'zustand';
import { getLogger } from '@/lib/logger/use-logger-client';

interface MyStore {
  data: string[];
  fetchData: () => Promise<void>;
}

export const useMyStore = create<MyStore>((set) => ({
  data: [],
  fetchData: async () => {
    const logger = getLogger();

    try {
      const response = await fetch('/api/data');
      const data = await response.json();

      logger.info({ count: data.length }, 'Store: Data fetched');
      set({ data });
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Store: Failed to fetch data',
      );
      throw error;
    }
  },
}));
```

### 6. Platform Services (Server-side)

Inject LoggerService via dependency injection:

```typescript
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

@injectable('MyService', 'Singleton')
class MyService {
  constructor(
    @inject('LoggerService') private logger: LoggerService
  ) {}

  async doSomething(): Promise<void> {
    this.logger.info('Doing something');
    
    try {
      // Business logic
      this.logger.debug('Operation completed');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Operation failed',
      );
      throw error;
    }
  }
}
```

## Best Practices

### 1. Always Include Context

Add relevant context to help with debugging:

```typescript
// ❌ Bad - no context
logger.error('Something failed');

// ✅ Good - includes context (context object first, then message)
logger.error(
  { userId, error: error.message, endpoint: '/api/users' },
  'Failed to fetch user',
);
```

### 2. Use Appropriate Log Levels

- **trace**: Only for extremely verbose debugging (rarely used)
- **debug**: Development-only information, disabled in production
- **info**: Significant events (user login, order created)
- **warn**: Potential issues that don't prevent operation
- **error**: Failures that affect functionality
- **fatal**: Critical failures that require immediate attention

### 2.5 Edge Middleware Logging

The Edge runtime does not use the DI containers, so `LoggerService` is not available in `src/proxy.ts` or `src/site/middleware.ts`. For edge-only logging (for example, misrouted health checks), use structured `console.warn` with JSON payloads:

```typescript
console.warn(
  JSON.stringify({
    event: 'misrouted_healthcheck',
    path: req.nextUrl.pathname,
    method: req.method,
    ua: req.headers.get('user-agent') ?? '',
  }),
);
```

### 2.6 Legacy Console Usage (To Be Migrated)

There are a few legacy `console.error` calls in server utilities that are pending migration to `LoggerService`:

- `src/lib/ssr/products.ts`
- `src/platform/services/session/impl/EmporixSessionService.ts`

New code should use `LoggerService` or `getLogger` as shown above.

### 3. Don't Log Sensitive Data

Never log passwords, tokens, credit card numbers, or PII:

```typescript
// ❌ Bad - logs sensitive data
logger.info({ email, password }, 'User login');

// ✅ Good - omits sensitive data
logger.info({ email, success: true }, 'User login');
```

### 4. Structure Error Logging

Include error details in a consistent format:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error(
    {
      operation: 'riskyOperation',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
    },
    'Operation failed',
  );
}
```

### 5. Use Child Loggers for Request Context

For request-scoped logging, include request identifiers:

```typescript
logger.info(
  {
    requestId: crypto.randomUUID(),
    method: request.method,
    path: request.nextUrl.pathname,
  },
  'Processing request',
);
```

## Output Format

### Development (pino-pretty + colorized JSON)

In development, logs are formatted for human readability using `pino-pretty`. API debug logs additionally use **ANSI color-coded JSON** for response bodies and headers:

- **Keys** in **cyan** (`"id"`, `"orders"`, `"total"`)
- **String values** in **yellow** (`"PENDING"`, `"EUR"`)
- **Numbers** in **magenta** (`35`, `1`)
- **Booleans / null** in **green** (`false`, `true`, `null`)
- **Labels** (`Headers:`, `Body:`) in **dim** gray

Example terminal output:

```
[20:40:07.229] DEBUG: [RETU-063t] [GET 200] /return/showcasedev/returns?pageNumber=1&pageSize=60
  Body: [
    {
      "id": "698dca3b77a5e440a638957c",
      "orders": [
        {
          "id": "EON1267",
          "items": [
            {
              "name": "EcoFlow Extension Cable",
              "quantity": 1,
              "unitPrice": { "value": 35, "currency": "EUR" }
            }
          ]
        }
      ],
      "approvalStatus": "PENDING",
      "received": false
    }
  ]
    module: "api-debug"
```

The colorization is implemented by `colorizeJson()` in `src/platform/core/utils/debug-utils.ts` and only activates in dev mode. Production output is unaffected.

### Production (JSON)

In production, logs are output as JSON for log aggregation:

```json
{"level":30,"time":1704729045123,"msg":"Processing request","path":"/api/users","method":"GET"}
```

## Browser Log Transmission

Client-side errors and warnings can be transmitted to the server for centralized logging. The application includes a `/api/logs` endpoint that receives browser logs.

Logger configuration is managed in `src/platform/core/config/logger-config.ts`.

## API Request Payload Logging

In development, you can enable logging of outgoing API request bodies by setting:

```env
NEXT_DEBUG_API_PAYLOAD=true
```

This logs the body of all POST/PUT/PATCH requests made through `EmporixApiInvoker` and `EmporixOAuthApi`, respecting the endpoint filtering configured via `NEXT_PUBLIC_DEBUG_API_ENDPOINTS`.

Combined with existing response logging (`NEXT_PUBLIC_DEBUG_API_RESPONSE`), this gives you full request/response visibility:

```env
# Full API debugging in development
NEXT_PUBLIC_DEBUG_API_CURL=true
NEXT_DEBUG_API_PAYLOAD=true
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=cart,order  # Optional: filter to specific endpoints
```

## Browser DevTools Debug Stream

When `NEXT_PUBLIC_DEBUG_API_RESPONSE` is set to any value other than `OFF`, the application provides a dual-output debug system that logs upstream API calls to **both** the server terminal and the browser DevTools Console.

### Call Classification

Every debug event is classified along two dimensions:

| Dimension | Values | Description |
| --- | --- | --- |
| **Call Type** | `internal` / `external` | **Internal** = browser → Next.js API route (e.g. `/api/approval/requires-approval`). **External** = server → upstream API (e.g. Emporix `POST /approval/{t}/approval/permitted`) |
| **Source** | `client` / `ssr` / `unknown` | Where the call originated. `client` = triggered by a browser fetch. `ssr` = during server-side rendering |

This lets you instantly see whether a failure is in your own API route logic or in the upstream response, and whether it was triggered by a user action or during page render.

### Colour Coding

**Terminal (ANSI):**
- Internal calls: **blue** background badge ` INTERNAL `
- External calls: **magenta** background badge ` EXTERNAL `
- Client source: cyan `[CLIENT]` badge
- SSR source: yellow `[SSR]` badge

**Browser Console:**
- Internal calls: blue `INT` badge with cyan-tinted URL
- External calls: purple `EXT` badge with magenta-tinted URL
- Errors (status ≥ 400) auto-expand, successes are collapsed

### Architecture

```
Browser fetch('/api/approval/requires-approval')
    │
    ├─── withApiRouteDebug()  ← wraps API route handler
    │        │
    │        └─── emits ApiDebugEvent { callType: 'internal', source: 'client' }
    │
    └─── API route handler
              │
              └─── ApprovalService → EmporixApiInvoker.fetch()
                       │
                       ├─── buildAndLogCurl(url, opts, { callType: 'external' })
                       ├─── logRequestPayload()
                       └─── logResponse()
                                │
                                └─── emits ApiDebugEvent { callType: 'external' }
                                         │
                                         └─── debugEventBus
                                                  │
                                                  ├─── Ring buffer (50 events)
                                                  └─── SSE subscribers
                                                           │
                                                           └─── /api/debug/stream
                                                                    │
                                                                    └─── ApiDebugPanel (browser)
                                                                              │
                                                                              └─── console.groupCollapsed()
                                                                                   with INT/EXT badge
```

### Filtering & Output Control

| Env Variable | Values | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_DEBUG_API_OUTPUT` | `BOTH` (default), `TERMINAL`, `BROWSER` | Where debug output is sent |
| `NEXT_PUBLIC_DEBUG_API_CALL_TYPE` | `ALL` (default), `INTERNAL`, `EXTERNAL` | Filter by call direction |
| `NEXT_PUBLIC_DEBUG_API_SOURCE` | `ALL` (default), `CLIENT`, `SSR` | Filter by call origin |
| `NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS` | `PAYLOAD,HEADERS,BODY` (default) | Comma-separated list of detail sections shown in browser Console |
| `NEXT_PUBLIC_DEBUG_API_LEVEL` | `ALL` (default), `WARN`, `ERROR` | Minimum severity: `ALL` = everything, `WARN` = status ≥ 400, `ERROR` = status ≥ 500 |

### Instrumenting API Routes

To log **internal** API calls (browser → `/api/*`), wrap your route handler with `withApiRouteDebug()`:

```typescript
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';

async function handler(request: NextRequest) {
  // ... your handler logic
  return NextResponse.json(result);
}

export const GET  = withApiRouteDebug(handler);
export const POST = withApiRouteDebug(handler);
```

This automatically logs:
- Request method, URL, duration
- Request payload (for POST/PUT/PATCH)
- Response status and body
- Emits an SSE event with `callType: 'internal'` for the browser Console

**Key implementation details:**

| Concept | Detail |
| --- | --- |
| **globalThis singleton** | `debugEventBus` uses `globalThis.__debugEventBus` to share a single instance across Next.js RSC and API Route module scopes (they are separate in dev mode) |
| **Replay buffer** | Events are stored in a ring buffer (50 max). When the browser's `EventSource` connects, all buffered events are replayed immediately — this captures SSR calls that happened before the browser loaded |
| **Single body read** | `response.clone().text()` is called once in `logResponse()` and shared between terminal log and SSE event. The caller consumes the original response with `.json()`, so a second clone would fail |
| **Sensitive data masking** | Headers, query params, and body containing tokens/secrets are masked as `******` unless `NEXT_PUBLIC_DEBUG_API_VERBOSE=true` |

**Files:**

| File | Role |
| --- | --- |
| `src/platform/core/utils/debug-utils.ts` | `buildAndLogCurl()`, `logResponse()`, `logRequestPayload()`, `attachDebugHeaders()`, `withApiRouteDebug()`, `colorizeJson()` |
| `src/platform/core/utils/debug-event-bus.ts` | `DebugEventBus` class, `globalThis` singleton, ring buffer, `ApiDebugEvent` interface, `DebugCallType` / `DebugCallSource` types |
| `src/app/api/debug/stream/route.ts` | SSE endpoint with replay + live subscription |
| `src/components/debug/ApiDebugPanel.tsx` | Invisible client component that renders events in browser Console with INT/EXT badges |

### 1. X-Debug Response Headers

Every response from your Next.js API routes can include debug headers visible in the browser **Network** tab:

| Header                      | Example                             | Description                    |
| --------------------------- | ----------------------------------- | ------------------------------ |
| `X-Debug-Upstream-Url`      | `/cart/showcasedev/carts/abc123`    | Upstream URL (masked)          |
| `X-Debug-Upstream-Status`   | `200`                               | Upstream HTTP status           |
| `X-Debug-Upstream-Duration` | `142ms`                             | Round-trip time                |

These headers are automatically attached by `attachDebugHeaders()` when called in API routes.

### 2. SSE Console Stream (ApiDebugPanel)

The SSE stream at `/api/debug/stream` pushes upstream API debug events to the browser in real time. The `ApiDebugPanel` component (loaded in the root layout whenever `NEXT_PUBLIC_DEBUG_API_RESPONSE` is not `OFF`) connects to this stream and pretty-prints each event in the browser **Console**:

- **Collapsible groups** — each API call is a `console.groupCollapsed` (or `console.group` for errors)
- **Color-coded** — green for 2xx, orange for 4xx, red for 5xx
- **JSON pretty-printing** — response bodies are parsed and displayed via `console.dir` with `depth: 10` for full object expansion
- **Headers as table** — response headers are displayed via `console.table`
- **Duration** — round-trip time shown in the group label
- **Auto-reconnect** — reconnects after 5 seconds on connection loss

This makes it trivial to inspect large JSON response bodies that would be hard to read as a single-line string in the server terminal.

### 3. Terminal Output (colorized pino-pretty)

In dev mode, terminal output uses `pino-pretty` with additional ANSI color-coding for JSON content:

- **Keys** in **cyan** (`"id"`, `"orders"`, `"total"`)
- **String values** in **yellow** (`"PENDING"`, `"EUR"`, `"EON1267"`)
- **Numbers** in **magenta** (`35`, `1`)
- **Booleans / null** in **green** (`false`, `true`, `null`)
- **Labels** (`Headers:`, `Body:`) in **dim** gray

JSON bodies and headers are multi-line indented for easy visual scanning.

#### Quick Start

1. Set these in `.env`:
   ```env
   NEXT_PUBLIC_DEBUG_API_CURL=true
   NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
   ```
2. Start the app in your target environment
3. Open your browser's DevTools Console
4. You'll see a "🔌 API Debug Stream connected" message
5. Every upstream API call will appear as a collapsible group in the Console **and** as colorized output in the terminal

#### Filtering: Show Only Specific API Calls

Use `NEXT_PUBLIC_DEBUG_API_ENDPOINTS` to limit which upstream API calls appear in both the **terminal** and the **browser Console stream**. The value is a comma-separated list of path substrings — only URLs containing at least one of these substrings will be logged.

| Goal | `.env` value |
|------|-------------|
| Log everything (default) | `NEXT_PUBLIC_DEBUG_API_ENDPOINTS=` |
| Only orders + returns | `NEXT_PUBLIC_DEBUG_API_ENDPOINTS=order,return` |
| Only cart calls | `NEXT_PUBLIC_DEBUG_API_ENDPOINTS=cart` |
| Only product + price | `NEXT_PUBLIC_DEBUG_API_ENDPOINTS=product,price` |
| Only session context | `NEXT_PUBLIC_DEBUG_API_ENDPOINTS=session-context` |

**Example — show only orders and returns:**

```bash
# .env
NEXT_PUBLIC_DEBUG_API_CURL=true
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=order,return
```

With this config:
- `/order/showcasedev/orders` → ✅ logged (contains `order`)
- `/return/showcasedev/returns` → ✅ logged (contains `return`)
- `/cart/showcasedev/carts/abc` → ❌ filtered out
- `/session-context/showcasedev/me/context` → ❌ filtered out

> **Tip:** The filter is case-insensitive and matches anywhere in the URL path. After changing the `.env` value, restart the dev server (`npm run dev`).

#### SSR Error Logging

All `lib/ssr/*` functions (returns, orders, carts, customer, products, session, site, approvals, price, search) log errors via `LoggerService` instead of silently swallowing them. When an SSR call fails (e.g. missing auth scope, network error), you'll see an `ERROR`-level log line in the **terminal** like:

```
ERROR [SSR getReturns failed] {"error":"Failed to get returns: ...","pageNumber":1}
```

These errors are always logged regardless of `NEXT_PUBLIC_DEBUG_API_ENDPOINTS` — the endpoint filter only applies to the upstream HTTP request/response debug stream, not to application-level error logs.

#### How to add X-Debug headers to an API route

Use `attachDebugHeaders()` in your API route after fetching from an upstream service:

```typescript
import { attachDebugHeaders } from '@/platform/core/utils/debug-utils';

export async function GET() {
  const startTime = Date.now();
  const upstream = await someService.fetch(url);
  
  const response = NextResponse.json(data);
  attachDebugHeaders(response, upstream, url, startTime);
  return response;
}
```

## Troubleshooting

### Logs Not Appearing

1. Check the log level configuration
2. Ensure `NEXT_PUBLIC_LOG_ENABLED` is `true` for client logs
3. Verify the logger is properly imported

### pino-pretty Not Working

1. Ensure `pino-pretty` is installed as a dev dependency (`npm ls pino-pretty`)
2. Check that `NODE_ENV=development`
3. Restart the development server

### Debug Stream Not Showing SSR Calls

SSR calls happen before the browser connects to the EventSource. The debug event bus buffers the last 50 events and replays them when the browser connects. If you're still not seeing SSR events:

1. Ensure `debugEventBus` uses the `globalThis` singleton pattern (check `debug-event-bus.ts`)
2. Verify `NEXT_PUBLIC_DEBUG_API_RESPONSE` is not `OFF`
3. Check endpoint filter is not excluding your URLs
4. Restart the dev server — the `globalThis` singleton persists across HMR but not across full restarts

### Response Body Shows `<error reading body>`

This means `response.clone().text()` was called after the response body was already consumed. The `logResponse()` function reads the body exactly once and shares it between the terminal log and the SSE event. If you see this error, check that no code between `buildAndLogCurl()` and `logResponse()` is consuming the response body.

### TypeScript Errors

Ensure you're importing from the correct location:
- React Components: `import { useLogger } from '@/hooks/common/useLogger'`
- Client libraries/stores: `import { getLogger } from '@/lib/logger/use-logger-client'`
- API routes (server): `import server from '@/platform/server'` then `server.get<LoggerService>('LoggerService')`
- Platform services (DI): `@inject('LoggerService') private logger: LoggerService`

### Logger API Pattern

The logger follows PINO's native API where the context object comes first, then the message:

```typescript
// ✅ Correct - context first, message second (PINO native order)
logger.error({ error: err.message }, 'Operation failed');

// ❌ Incorrect - message first, context second
logger.error('Operation failed', { error: err.message });
```

The logger supports both patterns for convenience:
- `logger.error(message)` - message only
- `logger.error(context, message)` - context first, then message (recommended)

## Related Documentation

- [Dependency Injection](./dependency-injection.md)
- [Layered Architecture](./layered-architecture.md)
- [Environment Variables](./environment-variables.md)
- [PINO Documentation](https://getpino.io/)
