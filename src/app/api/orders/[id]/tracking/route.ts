import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { TrackingService } from '@/platform/services/tracking/TrackingService';

/**
 * GET /api/orders/[id]/tracking
 * Get tracking information for a specific order
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const orderId = resolvedParams.id;

  try {
    const trackingService = server.get<TrackingService>('TrackingService');

    const trackingInfo = await trackingService.getOrderTrackingInfo(orderId);

    if (!trackingInfo) {
      return NextResponse.json({ error: 'Tracking information not found' }, { status: 404 });
    }

    return NextResponse.json(trackingInfo);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/orders/${orderId}/tracking`,
        method: 'GET',
        orderId,
      },
      `Error fetching tracking information for order ${orderId}`,
    );
    return NextResponse.json({ error: 'Failed to fetch tracking information' }, { status: 500 });
  }
}
