import { isBrowserDebugOutputEnabled, isDebugApiEnabled } from '@/lib/common/debug-env';
import { debugEventBus } from '@/platform/core/utils/debug-event-bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isBrowserDebugEnabled(): boolean {
  return isDebugApiEnabled() && isBrowserDebugOutputEnabled();
}

/**
 * GET /api/debug/stream
 *
 * Server-Sent Events endpoint that streams upstream API debug events
 * to the browser in real-time. DEV ONLY.
 *
 * The browser connects via EventSource and receives JSON-encoded
 * ApiDebugEvent objects, which the ApiDebugPanel renders in the
 * browser DevTools console with pretty formatting.
 */
export async function GET(): Promise<Response> {
  if (!isBrowserDebugEnabled()) {
    return new Response('Not available', { status: 404 });
  }

  const encoder = new TextEncoder();

  // Shared cleanup reference — set inside start(), called from cancel()
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`),
      );

      // Replay buffered events (SSR calls that happened before the browser connected)
      const buffered = debugEventBus.getRecentEvents();
      for (const event of buffered) {
        try {
          controller.enqueue(encoder.encode(`event: debug\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          break;
        }
      }

      // Keep-alive every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30_000);

      // Subscribe to debug events
      const unsubscribe = debugEventBus.subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(`event: debug\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
          unsubscribe();
          clearInterval(keepAlive);
        }
      });

      // Store cleanup for the cancel callback
      cleanup = () => {
        unsubscribe();
        clearInterval(keepAlive);
      };
    },
    cancel() {
      // Called when the client disconnects
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
