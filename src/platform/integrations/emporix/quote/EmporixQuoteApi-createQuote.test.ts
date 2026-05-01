import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../config';
import EmporixQuoteApi from './impl/EmporixQuoteApi';

/**
 * Regression tests for the token-type contract of `EmporixQuoteApi.createQuote`.
 *
 * The showcase now exclusively issues `QuoteCreateFromCartRequest` bodies here,
 * which per `resources/emporix/quote.yml` must be authenticated with a customer
 * `session` token (carries `legalEntityId` for B2B and the
 * `quote.quote_manage_own` scope). Flipping this back to `service` would
 * reintroduce the "Cannot find billing address … for customer" regression on
 * B2B legal-entity addresses.
 */
describe('EmporixQuoteApi.createQuote', () => {
  const mockConfig: EmporixConfig = {
    baseUrl: 'https://api.emporix.io',
    tenant: 'test-tenant',
    clientId: 'test-client-id',
    clientSecret: '',
    serverClientId: '',
    serverClientSecret: '',
  };

  let mockApiClient: jest.Mocked<EmporixApiInvoker>;
  let quoteApi: EmporixQuoteApi;

  beforeEach(() => {
    mockApiClient = {
      authenticatedFetch: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'Q-1000' }),
        text: jest.fn().mockResolvedValue(''),
        headers: new Headers(),
      } as unknown as Response),
    } as unknown as jest.Mocked<EmporixApiInvoker>;

    quoteApi = new EmporixQuoteApi(mockApiClient, mockConfig);
  });

  it('uses the session token type (not service) so B2B legalEntityId resolves', async () => {
    await quoteApi.createQuote({ cartId: 'cart-1' });

    expect(mockApiClient.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, options, tokenType] = mockApiClient.authenticatedFetch.mock.calls[0];

    expect(url).toBe('/quote/test-tenant/quotes');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(tokenType).toBe('session');
  });

  it('forwards only the cart-shape body to Emporix', async () => {
    await quoteApi.createQuote({
      cartId: 'cart-1',
      billingAddressId: 'le-loc-123',
      shippingAddressId: 'le-loc-123',
      shipping: {
        value: 10,
        methodId: 'de-standard-dhl',
        zoneId: 'de-shipping-zone',
        shippingTaxCode: 'STANDARD',
      },
    });

    const [, options] = mockApiClient.authenticatedFetch.mock.calls[0];
    const forwardedBody = JSON.parse(String((options as { body: string }).body));

    expect(forwardedBody).toEqual({
      cartId: 'cart-1',
      billingAddressId: 'le-loc-123',
      shippingAddressId: 'le-loc-123',
      shipping: {
        value: 10,
        methodId: 'de-standard-dhl',
        zoneId: 'de-shipping-zone',
        shippingTaxCode: 'STANDARD',
      },
    });
  });
});
