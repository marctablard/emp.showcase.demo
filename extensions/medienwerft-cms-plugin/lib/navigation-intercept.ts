/**
 * Navigation intercept for the CMS editor preview iframe.
 *
 * When the storefront is embedded in the editor's preview iframe and the user
 * clicks an internal link, the parent CMS needs a chance to offer
 * "open this page for editing?" instead of letting the iframe silently
 * navigate away. Browsers do not expose navigation of a cross-origin iframe to
 * the parent, so the storefront must cooperate.
 *
 * Protocol (all messages use `window.postMessage(msg, '*')`):
 *
 *   Storefront → Parent:  { type: 'NAVIGATION_INTERCEPTED', href, path, requestId }
 *   Parent → Storefront:  { type: 'NAVIGATION_RESPONSE', requestId, action: 'allow' }
 *
 * - `allow`                  → storefront performs the navigation.
 * - no response within 1.5 s → storefront falls back to `allow` so preview
 *                              never feels stuck when opened outside the editor.
 * - new click before reply   → previous pending request is cancelled.
 *
 * The handshake order is unchanged: this is purely additive to `IFRAME_READY`.
 *
 * @returns a cleanup function that removes every listener and timer.
 */
export function installNavigationIntercept(): () => void {
  // Only run when embedded in a parent frame.
  if (typeof window === 'undefined' || window.parent === window) {
    return () => {};
  }

  const PENDING = new Map<string, { href: string; timer: number }>();
  const RESPONSE_TIMEOUT_MS = 1500;

  const newRequestId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  const proceed = (href: string) => {
    // `assign` adds an entry to session history (same as a regular click).
    window.location.assign(href);
  };

  const isInternal = (a: HTMLAnchorElement): boolean => {
    // Only intercept same-origin <a> links. Cross-origin, mailto:, tel:,
    // blob:, downloads and target=_blank keep their native behavior.
    try {
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return false;
      if (a.target && a.target !== '_self') return false;
      if (a.hasAttribute('download')) return false;
      return true;
    } catch {
      return false;
    }
  };

  const onClick = (e: Event) => {
    // Respect modifier keys (open in new tab, etc.).
    const me = e as MouseEvent;
    if (me.defaultPrevented) return;
    if (me.button !== 0) return;
    if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;

    const target = e.target as HTMLElement | null;
    const a = target?.closest('a') as HTMLAnchorElement | null;
    if (!a || !a.href) return;
    if (!isInternal(a)) return;

    // Prevent the native navigation; the parent decides next. `preventDefault`
    // in the capture phase is also observed by SPA routers (e.g. Next.js
    // Link), so they will skip their own router.push.
    e.preventDefault();

    const url = new URL(a.href, window.location.href);
    const requestId = newRequestId();
    const timer = window.setTimeout(() => {
      // Parent didn't answer — fall back to a normal navigation so the
      // preview never feels stuck when opened outside the editor.
      const pending = PENDING.get(requestId);
      if (!pending) return;
      PENDING.delete(requestId);
      proceed(pending.href);
    }, RESPONSE_TIMEOUT_MS);

    PENDING.set(requestId, { href: a.href, timer });

    window.parent.postMessage(
      {
        type: 'NAVIGATION_INTERCEPTED',
        href: a.href,
        path: url.pathname + url.search + url.hash,
        requestId,
      },
      '*',
    );
  };

  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; requestId?: string; action?: string } | undefined;
    if (!data || data.type !== 'NAVIGATION_RESPONSE' || !data.requestId) return;
    const pending = PENDING.get(data.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    PENDING.delete(data.requestId);
    if (data.action === 'allow') proceed(pending.href);
    // Any other action → do nothing; the preventDefault already kept the user
    // on the current page.
  };

  // Capture phase so we run before SPA routers that also listen on click.
  document.addEventListener('click', onClick, true);
  window.addEventListener('message', onMessage);

  return () => {
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('message', onMessage);
    PENDING.forEach(({ timer }) => clearTimeout(timer));
    PENDING.clear();
  };
}
