import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { TrackingService } from '@/platform/services/tracking/TrackingService';

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
    console.error(`Error fetching tracking information for order ${orderId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch tracking information' }, { status: 500 });
  }
}
