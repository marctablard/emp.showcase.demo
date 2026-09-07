import { extractUpstreamMessage } from './extract-upstream-message';

describe('extractUpstreamMessage', () => {
  it('reads message from a JSON object', () => {
    expect(
      extractUpstreamMessage(
        JSON.stringify({
          message:
            'PriceIds : 69aad3ea58e76566001316be from cart are invalid. Please verify the existence of the listed prices and ensure that the tax classes associated with these prices are defined correctly.',
        }),
      ),
    ).toContain('tax classes associated with these prices');
  });

  it('reads message from a wrapped Error string', () => {
    expect(
      extractUpstreamMessage(
        'Failed to add item to cart: Bad Request {"message":"PriceIds : abc from cart are invalid."}',
      ),
    ).toBe('PriceIds : abc from cart are invalid.');
  });

  it('reads fault.faultstring', () => {
    expect(extractUpstreamMessage('{"fault":{"faultstring":"Given request is unauthorized"}}')).toBe(
      'Given request is unauthorized',
    );
  });
});
