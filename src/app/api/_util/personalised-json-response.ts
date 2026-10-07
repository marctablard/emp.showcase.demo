import { NextResponse } from 'next/server';
import type { ProductsModeContext } from '@/platform/services/products-mode/ProductsModeService';

export const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** Personalised responses (segmented customer, assigned or opted-in `all`) must never be cached. */
export function isPersonalised(ctx: Pick<ProductsModeContext, 'mode'> | undefined): boolean {
  return ctx?.mode === 'assigned' || ctx?.mode === 'all';
}

export function jsonResponse(body: unknown, personalised: boolean, status: number = 200): NextResponse {
  return NextResponse.json(body, personalised ? { status, headers: PRIVATE_NO_STORE } : { status });
}
