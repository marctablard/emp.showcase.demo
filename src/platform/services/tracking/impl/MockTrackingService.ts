import { addDays, format, subDays, subHours } from 'date-fns';
import { injectable } from '@/platform/core/di/injectable';
import type { TrackingInfo } from '@/platform/services/model/tracking';
import type { TrackingService } from '@/platform/services/tracking/TrackingService';

/**
 * 32-bit FNV-1a hash, used to derive a well-distributed deterministic seed from an orderId
 * (avoids collisions from a naive running `% 1000` accumulator).
 */
function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mock implementation of the TrackingService interface.
 * Provides dummy tracking data for demonstration purposes.
 */
@injectable('TrackingService', 'Singleton')
class MockTrackingService implements TrackingService {
  async getOrderTrackingInfo(orderId: string): Promise<TrackingInfo | null> {
    // Determine a deterministic pseudo-random seed from the orderId using a 32-bit FNV-1a hash,
    // which spreads similar orderIds across the output range far better than a running `% 1000`
    // accumulator (that approach collapsed most orderIds onto the same handful of seeds).
    const orderSeed = fnv1aHash(orderId);

    // Simulate API delay with deterministic duration between 300-600ms based on orderId
    const randomDelay = 300 + (orderSeed % 301);
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    // Generate deterministic tracking number based on orderId
    const trackingNumber = `EM${10000000 + (orderSeed % 90000000)}DE`;

    // Use current date as reference point
    const now = new Date();
    const orderCreatedDate = subDays(now, 3);

    // Determine status based on order ID's last character (for demo variety)
    const lastChar = orderId.at(-1) ?? '';
    const statusMap: Record<string, TrackingInfo['status']> = {
      '0': 'PENDING',
      '1': 'IN_TRANSIT',
      '2': 'IN_TRANSIT',
      '3': 'IN_TRANSIT',
      '4': 'IN_TRANSIT',
      '5': 'OUT_FOR_DELIVERY',
      '6': 'OUT_FOR_DELIVERY',
      '7': 'DELIVERED',
      '8': 'DELIVERED',
      '9': 'EXCEPTION',
    };

    const status = statusMap[lastChar] || 'IN_TRANSIT';

    // Generate events based on status
    const events: TrackingInfo['events'] = [];

    // Order created event (always present)
    events.push({
      timestamp: format(orderCreatedDate, "yyyy-MM-dd'T'HH:mm:ss"),
      location: 'Berlin, Germany',
      status: 'orderProcessed',
      description: 'orderProcessed',
    });

    // Package received by carrier (always present except for PENDING)
    if (status !== 'PENDING') {
      events.push({
        timestamp: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm:ss"),
        location: 'Berlin, Germany',
        status: 'packageReceived',
        description: 'packageReceived',
      });
    }

    // In transit events (for IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION)
    if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'].includes(status)) {
      events.push({
        timestamp: format(subDays(now, 1).setHours(10, 30, 0, 0), "yyyy-MM-dd'T'HH:mm:ss"),
        location: 'Hamburg, Germany',
        status: 'inTransit',
        description: 'inTransitNextCarrier',
      });

      // Add more transit events for longer journeys
      if (['3', '4', '8', '9'].includes(lastChar)) {
        events.push({
          timestamp: format(subDays(now, 1).setHours(16, 15, 0, 0), "yyyy-MM-dd'T'HH:mm:ss"),
          location: 'Frankfurt, Germany',
          status: 'inTransit',
          description: 'inTransitCarrierFacility',
        });
      }
    }

    // Out for delivery (for OUT_FOR_DELIVERY, DELIVERED)
    if (['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status)) {
      events.push({
        timestamp: format(subHours(now, 4), "yyyy-MM-dd'T'HH:mm:ss"),
        location: 'Local Distribution Center',
        status: 'outForDelivery',
        description: 'outForDelivery',
      });
    }

    // Delivered (for DELIVERED only)
    if (status === 'DELIVERED') {
      events.push({
        timestamp: format(subHours(now, 1), "yyyy-MM-dd'T'HH:mm:ss"),
        location: 'Destination Address',
        status: 'delivered',
        description: 'delivered',
      });
    }

    // Exception (for EXCEPTION only)
    if (status === 'EXCEPTION') {
      events.push({
        timestamp: format(subHours(now, 6), "yyyy-MM-dd'T'HH:mm:ss"),
        location: 'Local Distribution Center',
        status: 'exception',
        description: 'exceptionNoRecipient',
      });
    }

    // Sort events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate estimated delivery based on status
    let estimatedDelivery = undefined;
    if (['PENDING', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'EXCEPTION'].includes(status)) {
      const deliveryDate = addDays(now, status === 'OUT_FOR_DELIVERY' ? 0 : 1);
      estimatedDelivery = {
        date: format(deliveryDate, 'yyyy-MM-dd'),
        timeWindow: {
          from: '09:00',
          to: '18:00',
        },
      };
    }

    return {
      orderId,
      status,
      carrier: {
        name: 'Emporix Express',
        trackingNumber,
        trackingUrl: `https://track.emporix.com/${trackingNumber}`,
      },
      estimatedDelivery,
      events,
      lastUpdated: format(now, "yyyy-MM-dd'T'HH:mm:ss"),
    };
  }
}

export default MockTrackingService;
