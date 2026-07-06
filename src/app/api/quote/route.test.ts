import { POST } from './route';

/**
 * Route-level tests for `POST /api/quote`.
 *
 * Contract under test:
 * - Body accepts from-cart fields (`cartId`, `billingAddressId`, `shippingAddressId`,
 *   `shipping`) plus metadata (`reference`, `userComment`, `comment`).
 * - `reference`/`userComment` are mapped to Emporix `customerReference`/`customerComment`
 *   and forwarded in a single `QuoteService.createQuote` call (no chained metadata patch).
 * - Missing `cartId` returns 400 without calling Emporix.
 * - The internal employee `comment` is applied via a `/comment` patch in the
 *   `session` scope; when it is absent/empty no `updateQuote` call is made.
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
      addQuoteUserComment: jest.fn().mockResolvedValue(undefined),
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

  it('forwards the cart-shape body along with new top-level metadata fields to QuoteService.createQuote (single call)', async () => {
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
      customerReference: 'PO-42',
      customerComment: 'please hurry',
    });
    expect(schemaService.getSchema).not.toHaveBeenCalled();
    expect(quoteService.updateQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.updateQuote).toHaveBeenNthCalledWith(
      1,
      'Q-1000',
      [{ op: 'REPLACE', path: '/comment', value: 'internal note' }],
      'session',
    );
  });

  it('skips quote metadata updates entirely when all metadata fields are absent/empty', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
      }) as never,
    );

    expect(quoteService.createQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
    expect(quoteService.addQuoteUserComment).not.toHaveBeenCalled();
    expect(schemaService.getSchema).not.toHaveBeenCalled();
  });

  it('does NOT patch /shipping (shipping is sent in the create body per Emporix docs) and applies only the internal /comment patch', async () => {
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
    expect(scope).toBe('session');
    // No /shipping entry — shipping is already on the quote via the create body.
    expect(ops).toEqual([{ op: 'REPLACE', path: '/comment', value: 'internal note' }]);
    expect(schemaService.getSchema).not.toHaveBeenCalled();
  });

  it('does not look up the schema or patch metadata when reference/userComment are both empty', async () => {
    await POST(
      createRequest({
        cartId: 'cart-1',
        shipping: { value: 0, methodId: 'm1', zoneId: 'z1', shippingTaxCode: 'STANDARD' },
        comment: 'note',
        reference: '',
        userComment: '',
      }) as never,
    );

    expect(quoteService.updateQuote).toHaveBeenCalledTimes(1);
    expect(quoteService.addQuoteUserComment).not.toHaveBeenCalled();
    const [, ops] = quoteService.updateQuote.mock.calls[0];
    // Only `/comment` is patched — `/shipping` is covered by the create body.
    expect(ops).toEqual([{ op: 'REPLACE', path: '/comment', value: 'note' }]);
    expect(schemaService.getSchema).not.toHaveBeenCalled();
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
    expect(quoteService.addQuoteUserComment).not.toHaveBeenCalled();
    expect(schemaService.getSchema).not.toHaveBeenCalled();
  });

  it('still returns 201 when the session comment patch fails (create succeeded)', async () => {
    quoteService.updateQuote.mockRejectedValueOnce(new Error('patch boom'));

    const response = await POST(
      createRequest({
        cartId: 'cart-1',
        comment: 'internal note',
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(logger.error).toHaveBeenCalled();
  });

  it('ignores inquiry-only request fields and still creates a plain quote', async () => {
    const response = await POST(
      createRequest({
        cartId: 'cart-1',
        intent: 'INQUIRY',
        approverId: 'approver-1',
        userComment: 'approval note',
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(quoteService.createQuote).toHaveBeenCalledWith({
      cartId: 'cart-1',
      billingAddressId: undefined,
      shippingAddressId: undefined,
      shipping: undefined,
      customerComment: 'approval note',
    });
    expect(schemaService.getSchema).not.toHaveBeenCalled();
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ quoteId: 'Q-1000' });
  });

  it('returns 500 when QuoteService.createQuote throws', async () => {
    quoteService.createQuote.mockRejectedValueOnce(new Error('upstream down'));

    const response = await POST(createRequest({ cartId: 'cart-1' }) as never);

    expect(response.status).toBe(500);
    expect(quoteService.updateQuote).not.toHaveBeenCalled();
  });
});
