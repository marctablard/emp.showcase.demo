import { getLogger } from '@/lib/logger/use-logger-client';
import type { Cart } from '@/platform/services/model/cart/cart';
import type { Session } from '@/platform/services/model/session/session';

/** Fetch the current session; returns `null` on failure unless `throwOnError` is true. */
export async function fetchCurrentSession(throwOnError: boolean = false): Promise<Session | null> {
  try {
    const response = await fetch('/api/session', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.statusText}`);
    }

    const session = await response.json();
    return session;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching session');
    if (throwOnError) {
      throw error;
    }
    return null;
  }
}

/** Partial session context fields accepted by `PATCH /api/session`. */
export type SessionContextPatch = {
  siteCode?: string;
  currency?: string;
  language?: string;
  country?: string;
};

/**
 * Combined `PATCH /api/session` — prefer over per-field helpers so one upstream PATCH runs
 * and the canonical Session is returned. `expectedVersion` skips the pre-PATCH read.
 */
export async function updateSessionContext(
  fields: SessionContextPatch,
  expectedVersion?: number,
): Promise<Session | null> {
  try {
    const response = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...fields,
        ...(typeof expectedVersion === 'number' ? { expectedVersion } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update session context: ${response.statusText}`);
    }

    return (await response.json()) as Session;
  } catch (error) {
    getLogger().error({ err: error, fields }, 'Error updating session context');
    return null;
  }
}

export async function updateSessionLanguage(language: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update language: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, language }, 'Error updating language');
    return false;
  }
}

export interface UpdateSessionCurrencyResult {
  success: boolean;
  cart?: Cart | null;
  /** Set when `/api/session/currency` returns 409 (cart cannot be repriced in the target currency). */
  cartCurrencyBlocked?: boolean;
}

export async function updateSessionCurrency(currency: string): Promise<UpdateSessionCurrencyResult> {
  try {
    const response = await fetch('/api/session/currency', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency }),
    });

    const payload: unknown = await response.json().catch(() => ({}));
    const obj = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};

    if (!response.ok) {
      const cartCurrencyBlocked = response.status === 409;
      return { success: false, ...(cartCurrencyBlocked ? { cartCurrencyBlocked: true } : {}) };
    }

    const hasCart = Object.prototype.hasOwnProperty.call(obj, 'cart');
    return {
      success: obj.success !== false,
      ...(hasCart ? { cart: (obj.cart as Cart | null) ?? null } : {}),
    };
  } catch (error) {
    getLogger().error({ err: error, currency }, 'Error updating currency');
    return { success: false };
  }
}

export async function updateSessionCountry(country: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/country', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update country: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, country }, 'Error updating country');
    return false;
  }
}

export async function updateSessionSite(site: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update site: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, site }, 'Error updating site');
    return false;
  }
}

export async function updateSessionCompany(legalEntityId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ legalEntityId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update company: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, legalEntityId }, 'Error updating company');
    return false;
  }
}

export async function updateSessionRegion(region: string): Promise<boolean> {
  try {
    const response = await fetch('/api/session/region', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update region: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    getLogger().error({ err: error, region }, 'Error updating region');
    return false;
  }
}
