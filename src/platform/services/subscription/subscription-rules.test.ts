import {
  PRODUCT_SUBSCRIPTION_SCHEMA_ID,
  type Subscription,
  type SubscriptionProductRef,
  addInterval,
  cadenceIsLocked,
  itemsLockCadence,
  notificationDate,
  planRenewal,
  productSubscription,
  rollForward,
  scheduleFrom,
  withCadence,
  withItems,
  withStatus,
} from './subscription-rules';

const mixin = (value: Record<string, unknown>): SubscriptionProductRef => ({
  id: 'p',
  mixins: { [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: value },
});

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub-1',
  name: 'Acme · every 1 months',
  companyId: 'co',
  customerId: 'cu',
  status: 'ACTIVE',
  active: true,
  every: 1,
  unit: 'months',
  frequencyLocked: false,
  items: [{ productId: 'p1', quantity: 2 }],
  orders: [{ orderId: 'EON1', date: '2026-01-15T10:00:00.000Z' }],
  lastOrderDate: '2026-01-15T10:00:00.000Z',
  nextOrderDate: '2026-02-15T10:00:00.000Z',
  notificationDate: '2026-02-13T10:00:00.000Z',
  ...overrides,
});

describe('product subscription mixin', () => {
  it('maps the product fields onto the subscription cadence (names are swapped)', () => {
    expect(
      productSubscription(mixin({ subscription: true, frequency: 'months', interval: 1, fulfillment: 'SERVICE' })),
    ).toEqual({
      subscribable: true,
      fulfillment: 'SERVICE',
      every: 1,
      unit: 'months',
    });
  });

  it('locks digital and service products, and legacy products that already store a cadence', () => {
    expect(
      cadenceIsLocked(
        productSubscription(mixin({ subscription: true, frequency: 'months', interval: 1, fulfillment: 'DIGITAL' })),
      ),
    ).toBe(true);
    expect(
      cadenceIsLocked(
        productSubscription(mixin({ subscription: true, frequency: 'years', interval: 1, fulfillment: 'SERVICE' })),
      ),
    ).toBe(true);
    expect(cadenceIsLocked(productSubscription(mixin({ subscription: true, frequency: 'months', interval: 1 })))).toBe(
      true,
    );
    expect(cadenceIsLocked(productSubscription(mixin({ subscription: true, fulfillment: 'PHYSICAL' })))).toBe(false);
    expect(
      cadenceIsLocked(
        productSubscription(mixin({ subscription: true, frequency: 'months', interval: 3, fulfillment: 'PHYSICAL' })),
      ),
    ).toBe(false);
    expect(
      cadenceIsLocked(
        productSubscription(mixin({ subscription: false, frequency: 'months', interval: 1, fulfillment: 'SERVICE' })),
      ),
    ).toBe(false);
  });

  it('locks a subscription as soon as one of its products is digital or a service', () => {
    const physical = {
      id: 'p1',
      mixins: { [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: { subscription: true, fulfillment: 'PHYSICAL' } },
    };
    const digital = {
      id: 'p2',
      mixins: {
        [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: {
          subscription: true,
          fulfillment: 'DIGITAL',
          interval: 1,
          frequency: 'years',
        },
      },
    };
    const items = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
    ];
    expect(itemsLockCadence(items, [physical, digital])).toBe(true);
    expect(itemsLockCadence(items.slice(0, 1), [physical, digital])).toBe(false);
  });

  it('does not mutate the product', () => {
    const product = mixin({ subscription: true, frequency: 'days', interval: 14 });
    const original = JSON.parse(JSON.stringify(product));
    productSubscription(product);
    expect(product).toEqual(original);
  });
});

describe('schedule', () => {
  const from = new Date('2026-01-31T10:00:00.000Z');

  it('adds days, weeks, months and years in UTC', () => {
    expect(addInterval(from, 14, 'days').toISOString()).toBe('2026-02-14T10:00:00.000Z');
    expect(addInterval(from, 2, 'weeks').toISOString()).toBe('2026-02-14T10:00:00.000Z');
    expect(addInterval(from, 1, 'months').toISOString()).toBe('2026-03-03T10:00:00.000Z');
    expect(addInterval(from, 1, 'years').toISOString()).toBe('2027-01-31T10:00:00.000Z');
  });

  it('notifies two days before the next order', () => {
    expect(notificationDate(new Date('2026-02-15T10:00:00.000Z')).toISOString()).toBe('2026-02-13T10:00:00.000Z');
  });

  it('rolls a past due date forward without changing a future one', () => {
    const now = new Date('2026-04-01T00:00:00.000Z');
    expect(rollForward(new Date('2026-01-15T00:00:00.000Z'), 1, 'months', now).toISOString()).toBe(
      '2026-04-15T00:00:00.000Z',
    );
    expect(rollForward(new Date('2026-05-01T00:00:00.000Z'), 1, 'months', now).toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    );
  });

  it('schedules the next order from the last one', () => {
    const schedule = scheduleFrom(
      new Date('2026-01-15T10:00:00.000Z'),
      1,
      'months',
      new Date('2026-01-15T10:00:00.000Z'),
    );
    expect(schedule.nextOrderDate).toBe('2026-02-15T10:00:00.000Z');
    expect(schedule.notificationDate).toBe('2026-02-13T10:00:00.000Z');
  });
});

describe('planRenewal', () => {
  const service = (id: string, every = 1, unit = 'months'): SubscriptionProductRef => ({
    id,
    mixins: {
      [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: {
        subscription: true,
        fulfillment: 'SERVICE',
        interval: every,
        frequency: unit,
      },
    },
  });
  const physical = (id: string): SubscriptionProductRef => ({
    id,
    mixins: { [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: { subscription: true, fulfillment: 'PHYSICAL' } },
  });

  it('takes a read-only cadence from digital or service products and includes every line', () => {
    const plan = planRenewal(
      [
        { productId: 'svc', quantity: 1 },
        { productId: 'box', quantity: 4 },
      ],
      [service('svc'), physical('box')],
      { every: 3, unit: 'weeks' },
    );
    expect(plan).toEqual({
      ok: true,
      every: 1,
      unit: 'months',
      locked: true,
      items: [
        { productId: 'svc', quantity: 1 },
        { productId: 'box', quantity: 4 },
      ],
    });
  });

  it('refuses digital products that renew on different schedules', () => {
    const plan = planRenewal(
      [
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 1 },
      ],
      [service('a', 1, 'months'), service('b', 1, 'years')],
    );
    expect(plan).toEqual({ ok: false, issue: 'conflicting-cadence' });
  });

  it('uses the chosen cadence for physical products', () => {
    const plan = planRenewal([{ productId: 'box', quantity: 2 }], [physical('box')], { every: 2, unit: 'weeks' });
    expect(plan).toMatchObject({ ok: true, every: 2, unit: 'weeks', locked: false });
  });

  it('rejects an empty order and a missing cadence', () => {
    expect(planRenewal([], [], { every: 1, unit: 'months' })).toEqual({ ok: false, issue: 'empty' });
    expect(planRenewal([{ productId: 'box', quantity: 1 }], [physical('box')], { every: 0, unit: 'months' })).toEqual({
      ok: false,
      issue: 'invalid-every',
    });
  });
});

describe('subscription edits', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');

  it('pauses, resumes and cancels without mutating the input', () => {
    const original = sub();
    const paused = withStatus(original, 'PAUSED', now);
    expect(paused.status).toBe('PAUSED');
    expect(paused.active).toBe(false);
    expect(paused.nextOrderDate).toBe(original.nextOrderDate);
    expect(original.status).toBe('ACTIVE');

    const resumed = withStatus(paused, 'ACTIVE', now);
    expect(resumed.status).toBe('ACTIVE');
    expect(resumed.active).toBe(true);
    expect(resumed.nextOrderDate).toBe('2026-03-15T10:00:00.000Z');

    const cancelled = withStatus(original, 'CANCELLED', now);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.active).toBe(false);
    expect(cancelled.endDate).toBe('2026-03-01');
    expect(withStatus(cancelled, 'ACTIVE', now).status).toBe('CANCELLED');
  });

  it('changes cadence for physical subscriptions and refuses it when locked', () => {
    const changed = withCadence(sub(), 2, 'weeks', now);
    expect(changed.every).toBe(2);
    expect(changed.unit).toBe('weeks');
    expect(changed.nextOrderDate).toBe('2026-03-12T10:00:00.000Z');
    expect(() => withCadence(sub({ frequencyLocked: true }), 2, 'weeks', now)).toThrow(/cannot be changed/);
    expect(() => withCadence(sub({ status: 'CANCELLED' }), 2, 'weeks', now)).toThrow(/cancelled/);
  });

  it('replaces products and locks the cadence when a service product is added', () => {
    const service: SubscriptionProductRef = {
      id: 'svc',
      mixins: {
        [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: {
          subscription: true,
          fulfillment: 'SERVICE',
          interval: 1,
          frequency: 'years',
        },
      },
    };
    const changed = withItems(sub(), [{ productId: 'svc', quantity: 1 }], [service], now);
    expect(changed.frequencyLocked).toBe(true);
    expect(changed.every).toBe(1);
    expect(changed.unit).toBe('years');
    expect(changed.items).toEqual([{ productId: 'svc', quantity: 1 }]);
    expect(sub().items).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it('unlocks the cadence when the digital product is removed', () => {
    const physical: SubscriptionProductRef = {
      id: 'box',
      mixins: { [PRODUCT_SUBSCRIPTION_SCHEMA_ID]: { subscription: true, fulfillment: 'PHYSICAL' } },
    };
    const changed = withItems(
      sub({ frequencyLocked: true, every: 1, unit: 'months' }),
      [{ productId: 'box', quantity: 3 }],
      [physical],
      now,
    );
    expect(changed.frequencyLocked).toBe(false);
    expect(changed.every).toBe(1);
    expect(changed.unit).toBe('months');
  });
});
