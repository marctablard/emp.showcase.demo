import { POST } from './route';

/**
 * Route-level tests for `POST /api/quote`.
 *
 * Contract under test:
 * - Body accepts from-cart fields (`cartId`, `billingAddressId`, `shippingAddressId`,
 *   `shipping`) plus metadata (`reference`, `userComment`, `comment`).
 * - Only the Emporix `QuoteCreateFromCartRequest` shape is forwarded to
 *   `QuoteService.createQuote` — metadata is stripped and re-applied via PATCH.
 * - Missing `cartId` returns 400 without calling Emporix.
 * - Empty metadata does not trigger a PATCH (no schema read, no updateQuote).
 * - Non-empty metadata fields are applied via one `updateQuote` call with the
 *   expected op list.
 */

jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type MockService = { [method: string]: jest.Mock };

function createRequest(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('POST /api/quote', () => {
  let quoteService: MockService;
  let schemaService: MockService;
  let sessionService: MockService;
  let customerService: MockService;
  let logger: MockService;

  beforeEach(() => {
    quoteService = {
      createQuote: jest.fn().mockResolvedValue({ quoteId: 'Q-1000' }),
      updateQuote: jest.fn().mockResolvedValue(undefined),
    };
    schemaService = {
      getSchema: jest.fn().mockResolvedValue({ metadata: { url: 'https://schemas/additionalInfo' } }),
    };
    sessionService = {
      getCurrent: jest.fn().mockResolvedValue({ id: 's1', siteCode: 'main', currency: 'EUR' }),
    };
    customerService = {
      getCustomer: jest.fn().mockResolvedValue({ id: 'c1', businessModel: 'B2B' }),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('QuoteService', quoteService);
    mockedServer.default.__services.set('SchemaService', schemaService);
    mockedServer.default.__services.set('SessionService', sessionService);
    mockedServer.default.__services.set('CustomerService', customerService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('returns 400 when cartId is missing and does not call Emporix', async () => {
    const response = await POST(createRequest({ billingAddressId: 'b1' }) as never);

    expect(response.status).toBe(400);
    expect(quoteService.createQuote).not.toHaveBeenCalled();
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
  });

  it('forwards only the cart-shape body to QuoteService.createQuote (strips metadata)', async () => {
    const response = await POST(
      createRequest({
        cartId: 'cart-1',
        billingAddressId: 'le-loc-1',
        shippingAddressId: 'le-loc-1',
        shipping: { value: 0, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
        reference: 'PO-42',
        userComment: 'please hurry',
        comment: 'internal note',
        // These extra fields belong to the old manual payload and must NOT leak
        // to Emporix via this route anymore.
        items: [{ foo: 'bar' }],
        customerId: 'c-legacy',
        siteCode: 'legacy-site',
        currency: 'USD',
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(quoteService.createQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.createQuote).toHaveBeenCalledWith({
      cartId: 'cart-1',
      billingAddressId: 'le-loc-1',
      shippingAddressId: 'le-loc-1',
      shipping: { value: 0, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
    });
  });

  it('skips PATCH entirely when all metadata fields are absent/empty', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
      }) as never,
    );

    expect(quoteService.createQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
    expect(schemaService.getSchema).not.toHaveBeenCalled();
  });

  it('does NOT patch /shipping (shipping is sent in the create body per Emporix docs) and applies only comment/mixin ops', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
        shipping: { value: 5, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
        comment: 'internal note',
        reference: 'PO-42',
        userComment: 'please hurry',
      }) as never,
    );

    expect(quoteService.updateQuote).toHaveBeenCalledTimes(1);
    const [quoteId, ops, scope] = quoteService.updateQuote.mock.calls[0];
    expect(quoteId).toBe('Q-1000');
    expect(scope).toBe('service');
    // No /shipping entry — shipping is already on the quote via the create body.
    expect(ops).toEqual([
      { op: 'REPLACE', path: '/comment', value: 'internal note' },
      { op: 'ADD', path: '/mixins/additionalInfo', value: { reference: 'PO-42', userComment: 'please hurry' } },
      { op: 'ADD', path: '/metadata/mixins/additionalInfo', value: 'https://schemas/additionalInfo' },
    ]);
  });

  it('does not fetch the mixin schema when reference/userComment are both empty', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
        shipping: { value: 0, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
        comment: 'note',
        reference: '',
        userComment: '',
      }) as never,
    );

    expect(schemaService.getSchema).not.toHaveBeenCalled();
    expect(quoteService.updateQuote).toHaveBeenCalledTimes(1);
    const [, ops] = quoteService.updateQuote.mock.calls[0];
    // Only `/comment` is patched — `/shipping` is covered by the create body.
    expect(ops).toEqual([{ op: 'REPLACE', path: '/comment', value: 'note' }]);
  });

  it('skips PATCH entirely when only shipping is provided (shipping is covered by the create body)', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
        shipping: { value: 5, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
      }) as never,
    );

    expect(quoteService.createQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
    expect(schemaService.getSchema).not.toHaveBeenCalled();
  });

  it('still returns 201 when PATCH fails (create succeeded)', async () => {
    quoteService.updateQuote.mockRejectedValueOnce(new Error('patch boom'));

    const response = await POST(
      createRequest({
        cartId: 'cart-1',
        reference: 'PO-42',
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns 500 when QuoteService.createQuote throws', async () => {
    quoteService.createQuote.mockRejectedValueOnce(new Error('upstream down'));

    const response = await POST(createRequest({ cartId: 'cart-1' }) as never);

    expect(response.status).toBe(500);
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
  });
});
