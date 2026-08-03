import type { DebugCallSource } from '@/platform/core/utils/debug-event-bus';

export interface RequestContextService {
  getSite(): Promise<string>;
  /**
   * Returns the shopper's preferred currency from the currency cookie, or
   * `undefined` when the cookie is missing / empty. The caller decides whether
   * to fall back to an env default — {@link EmporixTokenManagerServer.resolveSessionParams}
   * uses `undefined` to mean "fall through to `NEXT_PUBLIC_DEFAULT_CURRENCY`".
   */
  getCurrency(): Promise<string | undefined>;
  /**
   * Returns the shopper's preferred language from the locale cookie
   * (`NEXT_PUBLIC_LOCALE_COOKIE`, default `NEXT_LOCALE`), or `undefined` when
   * not set. Mirrors {@link getCurrency}.
   */
  getLanguage(): Promise<string | undefined>;
  /**
   * Where the current call *originated* — deliberately not the runtime that executes it.
   *
   * `DebugCallSource` has no `'server'` member: the server/upstream axis is carried by
   * {@link DebugContext.callType} (`external` = server → upstream API), so this field is
   * only ever `'client'` (browser-triggered) or `'ssr'` (render pass). That makes the
   * mapping look inverted at first glance and it is intentional:
   *
   * - Server impl  → `'client'`: API route handlers exist because a browser called them.
   *   Same convention as `withApiRouteDebug`, which tags route handlers `source: 'client'`.
   * - SSR impl     → `'ssr'`:    RSC / server-side render pass.
   * - Client impl  → `'client'`: browser.
   *
   * Consumed by the debug tooling for the `[CLIENT]`/`[SSR]` badge and the
   * `NEXT_PUBLIC_DEBUG_API_SOURCE` filter, which likewise only accepts `client`/`ssr`.
   *
   * Synchronous by design: the value is a per-environment constant, and callers such as
   * `EmporixApiInvoker.applyCacheOptions` are synchronous.
   */
  getCallSource(): DebugCallSource;
}
