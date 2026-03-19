import { NextResponse } from 'next/server';
import { validateEnvVars } from '@/platform/healthcheck/env-validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Readiness probe endpoint.
 *
 * Keep this local-only (env/config checks). Do NOT call upstream services,
 * otherwise probes can amplify outages into traffic spikes.
 */
export async function GET(): Promise<NextResponse> {
  const result = validateEnvVars();
  const missing = result.items.filter((item) => !item.passed && item.severity === 'error').map((item) => item.name);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        status: 'not-ready',
        missing,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return NextResponse.json(
    { status: 'ready', timestamp: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
