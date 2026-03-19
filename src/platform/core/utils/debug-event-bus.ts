/**
 * Server-side event bus for API debug events.
 * Used to relay upstream API request/response info to the browser via SSE.
 */

type DebugEventListener = (event: ApiDebugEvent) => void;

/**
 * Classifies the direction of the API call:
 * - `internal`  — browser → Next.js API route (e.g. `/api/approval/requires-approval`)
 * - `external`  — server  → upstream/external API (e.g. Emporix `POST /approval/{t}/approval/permitted`)
 */
export type DebugCallType = 'internal' | 'external';

/**
 * Classifies where the call originated:
 * - `client` — triggered by a browser fetch to an API route
 * - `ssr`    — triggered during server-side rendering / RSC
 */
export type DebugCallSource = 'client' | 'ssr' | 'unknown';

export interface ApiDebugEvent {
  /** Unique request identifier */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** HTTP method */
  method: string;
  /** Upstream URL (masked if sensitive) */
  url: string;
  /** HTTP status code */
  status?: number;
  /** Response headers (masked if sensitive) */
  responseHeaders?: Record<string, string>;
  /** Response body text */
  responseBody?: string;
  /** Request payload (masked/truncated if sensitive) */
  requestBody?: string;
  /** Duration in ms */
  duration?: number;
  /** Log prefix (e.g., [PROD-02de]) */
  prefix?: string;
  /** Whether this was an error response (status >= 400) */
  isError?: boolean;
  /** Internal (Next.js API route) vs External (upstream API) */
  callType?: DebugCallType;
  /** Where the call originated: client / ssr / unknown */
  source?: DebugCallSource;
}

/** Maximum number of recent events to buffer for replay on new SSE connections */
const REPLAY_BUFFER_SIZE = 50;

class DebugEventBus {
  private listeners = new Set<DebugEventListener>();
  private recentEvents: ApiDebugEvent[] = [];

  /**
   * Subscribe to debug events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: DebugEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a debug event to all subscribers and buffer it for replay.
   * Events are always buffered so SSR calls (which happen before any
   * browser connects) can be replayed when the EventSource connects.
   */
  emit(event: ApiDebugEvent): void {
    // Always buffer — SSR events happen before any browser connects
    this.recentEvents.push(event);
    if (this.recentEvents.length > REPLAY_BUFFER_SIZE) {
      this.recentEvents.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow errors in listeners to avoid affecting the main flow
      }
    }
  }

  /**
   * Get buffered events for replay on new SSE connections.
   */
  getRecentEvents(): ApiDebugEvent[] {
    return [...this.recentEvents];
  }

  /** Number of active subscribers (for diagnostics) */
  get subscriberCount(): number {
    return this.listeners.size;
  }
}

/**
 * Singleton debug event bus.
 * Uses globalThis to ensure a single instance across all Next.js server contexts
 * (RSC layer, API routes, middleware) — without this, Next.js dev mode may create
 * separate module instances for each layer, breaking the replay buffer.
 */
const globalForDebug = globalThis as typeof globalThis & { __debugEventBus?: DebugEventBus };

export const debugEventBus = (globalForDebug.__debugEventBus ??= new DebugEventBus());
