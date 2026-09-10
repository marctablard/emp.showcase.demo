import { getLogger } from '@/lib/logger/use-logger-client';
import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';

/** Modes a segmented customer may request; `anonymous`/`unsegmented` are server-derived only. */
export type RequestedProductsMode = Extract<ProductsMode, 'all' | 'assigned'>;

export interface SetProductsModeResult {
  ok: boolean;
  /** Mode confirmed by the server on success. */
  mode?: ProductsMode;
}

/**
 * `PUT /api/customer-segment/products-mode` (COP-4822) — toggles the "ALL PRODUCTS MODE"
 * opt-in cookie. The server validates `canToggleAllProducts`; a 403 means the toggle is not
 * available for this customer. The CSRF header is injected by the global fetch override.
 */
export async function setProductsMode(mode: RequestedProductsMode): Promise<SetProductsModeResult> {
  try {
    const response = await fetch('/api/customer-segment/products-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to update products mode: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { mode?: ProductsMode };
    return { ok: true, mode: payload.mode ?? mode };
  } catch (error) {
    getLogger().error({ err: error, mode }, 'Error updating products mode');
    return { ok: false };
  }
}
