'use client';

/* eslint-disable no-console -- This component intentionally logs to the browser console for DevTools debugging */
import { useEffect, useRef } from 'react';
import { isBrowserDebugOutputEnabled, isDebugApiEnabled } from '@/lib/common/debug-env';

interface ApiDebugEvent {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  requestBody?: string;
  duration?: number;
  prefix?: string;
  isError?: boolean;
  callType?: 'internal' | 'external';
  source?: 'client' | 'ssr' | 'unknown';
}

// ---------------------------------------------------------------------------
// Browser detail configuration
// ---------------------------------------------------------------------------
type BrowserDetail = 'payload' | 'headers' | 'body';

function getBrowserDetails(): Set<BrowserDetail> {
  const raw = (process.env.NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS || 'payload,headers,body').toLowerCase();
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<BrowserDetail>();
  for (const p of parts) {
    if (p === 'payload') {
      allowed.add('payload');
      continue;
    }
    if (p === 'headers') {
      allowed.add('headers');
      continue;
    }
    // Accept BODY and BODY-{n} forms so env values like BODY-200 still enable body output.
    if (p === 'body' || /^body-\d+$/.test(p)) {
      allowed.add('body');
    }
  }
  if (allowed.size === 0) {
    allowed.add('payload');
    allowed.add('headers');
    allowed.add('body');
  }
  return allowed;
}

function getCallTypeFilter(): string {
  return (process.env.NEXT_PUBLIC_DEBUG_API_CALL_TYPE || 'all').toLowerCase();
}

function getSourceFilter(): string {
  return (process.env.NEXT_PUBLIC_DEBUG_API_SOURCE || 'all').toLowerCase();
}

function getDebugLevel(): string {
  return (process.env.NEXT_PUBLIC_DEBUG_API_LEVEL || 'all').toLowerCase();
}

// ---------------------------------------------------------------------------
// Style constants for console output — different themes per call type
// ---------------------------------------------------------------------------
const STYLES = {
  // Shared
  method: 'color: #8be9fd; font-weight: bold',
  url: 'color: #bd93f9',
  duration: 'color: #6272a4; font-style: italic',
  label: 'color: #f1fa8c; font-weight: bold',
  reset: '',

  // Status codes
  status2xx: 'color: #50fa7b; font-weight: bold',
  status4xx: 'color: #ffb86c; font-weight: bold',
  status5xx: 'color: #ff5555; font-weight: bold',

  // Call-type badges
  internalBadge: 'background: #1e3a5f; color: #8be9fd; padding: 1px 6px; border-radius: 3px; font-weight: bold',
  externalBadge: 'background: #3d1f5c; color: #bd93f9; padding: 1px 6px; border-radius: 3px; font-weight: bold',

  // Internal call colours (blue theme)
  internalLabel: 'color: #8be9fd; font-weight: bold',
  internalUrl: 'color: #56b6e0',

  // External call colours (magenta theme)
  externalLabel: 'color: #bd93f9; font-weight: bold',
  externalUrl: 'color: #9a6dd7',

  // Source badges
  clientSource: 'color: #8be9fd; font-style: italic',
  ssrSource: 'color: #f1fa8c; font-style: italic',
} as const;

function getStatusStyle(status?: number): string {
  if (!status) return STYLES.reset;
  if (status >= 500) return STYLES.status5xx;
  if (status >= 400) return STYLES.status4xx;
  return STYLES.status2xx;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function logEventToConsole(event: ApiDebugEvent): void {
  // --- Apply call-type, source, and level filters ---
  const ctFilter = getCallTypeFilter();
  if (ctFilter !== 'all' && event.callType && event.callType !== ctFilter) return;
  const srcFilter = getSourceFilter();
  if (srcFilter !== 'all' && event.source && event.source !== srcFilter) return;
  const level = getDebugLevel();
  if (level === 'warn' && event.status !== undefined && event.status < 400) return;
  if (level === 'error' && event.status !== undefined && event.status < 500) return;

  const browserDetails = getBrowserDetails();
  const isInternal = event.callType === 'internal';
  const statusStyle = getStatusStyle(event.status);
  const durationStr = event.duration ? ` (${event.duration}ms)` : '';
  const prefixStr = event.prefix ? `${event.prefix} ` : '';

  // Build the group label with call-type badge
  const badgeStyle = isInternal ? STYLES.internalBadge : STYLES.externalBadge;
  const badgeLabel = isInternal ? 'INT' : 'EXT';
  const urlStyle = isInternal ? STYLES.internalUrl : STYLES.externalUrl;
  const labelStyle = isInternal ? STYLES.internalLabel : STYLES.externalLabel;
  const arrow = isInternal ? '⬇' : '⬆';

  const groupLabel = `%c ${badgeLabel} %c ${arrow} API %c${event.method} %c${event.status ?? '?'} %c${prefixStr}${event.url}%c${durationStr}`;

  // Use groupCollapsed for non-errors, group for errors
  const groupFn = event.isError ? console.group : console.groupCollapsed;
  groupFn(groupLabel, badgeStyle, labelStyle, STYLES.method, statusStyle, urlStyle, STYLES.duration);

  // Source badge
  if (event.source && event.source !== 'unknown') {
    const srcStyle = event.source === 'client' ? STYLES.clientSource : STYLES.ssrSource;
    console.log(`%cSource: ${event.source.toUpperCase()}`, srcStyle);
  }

  // Request body (payload)
  if (browserDetails.has('payload') && event.requestBody) {
    const parsed = tryParseJson(event.requestBody);
    if (parsed !== null) {
      console.groupCollapsed('%cRequest Payload (JSON)', STYLES.label);
      console.dir(parsed, { depth: 10 });
      console.groupEnd();
    } else {
      console.groupCollapsed('%cRequest Payload (text)', STYLES.label);
      console.log(event.requestBody);
      console.groupEnd();
    }
  }

  // Response headers
  if (browserDetails.has('headers') && event.responseHeaders && Object.keys(event.responseHeaders).length > 0) {
    console.groupCollapsed('%cResponse Headers', STYLES.label);
    console.table(event.responseHeaders);
    console.groupEnd();
  }

  // Response body
  if (browserDetails.has('body') && event.responseBody) {
    const parsed = tryParseJson(event.responseBody);
    if (parsed !== null) {
      console.groupCollapsed('%cResponse Body (JSON)', STYLES.label);
      console.dir(parsed, { depth: 10 });
      console.groupEnd();
    } else {
      console.groupCollapsed('%cResponse Body (text)', STYLES.label);
      console.log(event.responseBody);
      console.groupEnd();
    }
  }

  console.groupEnd();
}

/**
 * Invisible component that connects to the server-side debug
 * event stream (SSE) and pretty-prints upstream API calls in the
 * browser DevTools console.
 *
 * Renders nothing to the DOM.
 *
 * Enable by setting NEXT_PUBLIC_DEBUG_API_RESPONSE to any value other
 * than 'off' (e.g. STATUS, STATUS-BODY, FULL).
 */
export function ApiDebugPanel(): null {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Connect only when debug response logging is enabled
    if (!isDebugApiEnabled() || !isBrowserDebugOutputEnabled()) return;

    let isMounted = true;

    function connect(): void {
      if (!isMounted) return;

      const es = new EventSource('/api/debug/stream');
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        const ct = getCallTypeFilter();
        const src = getSourceFilter();
        const details = Array.from(getBrowserDetails()).join(', ');
        const filters = [ct !== 'all' ? `callType=${ct}` : null, src !== 'all' ? `source=${src}` : null]
          .filter(Boolean)
          .join(', ');
        const filterStr = filters ? ` | Filters: ${filters}` : '';
        console.log(
          `%c🔌 API Debug Stream connected — upstream API calls will appear here\n   Details: ${details}${filterStr}`,
          'color: #50fa7b; font-weight: bold',
        );
      });

      es.addEventListener('debug', (e: MessageEvent) => {
        try {
          const event: ApiDebugEvent = JSON.parse(e.data);
          logEventToConsole(event);
        } catch {
          // Ignore malformed events
        }
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 5 seconds
        if (isMounted) {
          reconnectTimerRef.current = setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return null;
}
