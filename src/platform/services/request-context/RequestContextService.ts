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
}
