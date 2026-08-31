import { matchDeliveryWindowForShippingMethod } from './match-delivery-window';

describe('matchDeliveryWindowForShippingMethod', () => {
  const windows = [
    {
      id: 'later',
      deliveryDate: '2026-09-03T10:00:00.000Z',
      slotId: 'slot-b',
      zoneId: 'zone-de',
      deliveryMethod: 'DHL Standard',
    },
    {
      id: 'earlier',
      deliveryDate: '2026-09-02T10:00:00.000Z',
      slotId: 'slot-a',
      zoneId: 'zone-de',
      deliveryMethod: 'DHL Standard',
    },
    {
      id: 'express',
      deliveryDate: '2026-09-02T08:00:00.000Z',
      slotId: 'slot-x',
      zoneId: 'zone-de',
      deliveryMethod: 'dhl-express',
    },
  ];

  it('matches by method name and picks the earliest window', () => {
    const match = matchDeliveryWindowForShippingMethod(windows, {
      methodId: 'dhl-standard',
      zoneId: 'zone-de',
      methodName: 'DHL Standard',
    });
    expect(match?.id).toBe('earlier');
  });

  it('matches by method id when deliveryMethod is the id', () => {
    const match = matchDeliveryWindowForShippingMethod(windows, {
      methodId: 'dhl-express',
      zoneId: 'zone-de',
    });
    expect(match?.id).toBe('express');
  });

  it('returns undefined when zone differs', () => {
    const match = matchDeliveryWindowForShippingMethod(windows, {
      methodId: 'dhl-standard',
      zoneId: 'zone-ch',
      methodName: 'DHL Standard',
    });
    expect(match).toBeUndefined();
  });

  it('returns undefined when no window matches', () => {
    const match = matchDeliveryWindowForShippingMethod(windows, {
      methodId: 'pickup',
      zoneId: 'zone-de',
      methodName: 'Pickup',
    });
    expect(match).toBeUndefined();
  });
});
