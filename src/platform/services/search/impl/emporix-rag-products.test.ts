import { productIdsFromAgentMessage, shouldTryProductRag } from './emporix-rag-products';

describe('productIdsFromAgentMessage', () => {
  it('reads product ids from a product_list envelope', () => {
    const message = JSON.stringify({
      message: 'Matching products',
      type: 'product_list',
      sessionId: 'session-1',
      data: {
        products: [
          { productId: 'solar-1', name: 'Solar Panel' },
          { productId: 'solar-1', name: 'Solar Panel' },
          { productId: 'inverter-2', name: 'Inverter' },
        ],
      },
    });

    expect(productIdsFromAgentMessage(message)).toEqual(['solar-1', 'inverter-2']);
  });

  it('reads catalog ids from the product RAG agent payload', () => {
    const message = JSON.stringify({
      products: [{ id: 'bluesolar-victron-55w' }, { id: 'fw-p-004--a915f55e-943f-40af-9065-3a29f65ed9e8' }],
    });

    expect(productIdsFromAgentMessage(message)).toEqual([
      'bluesolar-victron-55w',
      'fw-p-004--a915f55e-943f-40af-9065-3a29f65ed9e8',
    ]);
  });

  it('reads a productIds reference list', () => {
    const message = JSON.stringify({
      type: 'product_list',
      data: { productIds: ['panel-1', 'not an id', 'panel-2'] },
    });

    expect(productIdsFromAgentMessage(message)).toEqual(['panel-1', 'panel-2']);
  });

  it('prefers the catalog id over the search code on indexed RAG hits', () => {
    const message = JSON.stringify({
      data: {
        results: [
          {
            chunk: 'solar panel',
            metadata: {
              id: 'auroratech-smart-solar-solution',
              code: 'auroratech-smart-solar-solution-nominal-power-600w',
              _id: 'mongo-1',
            },
          },
        ],
      },
    });

    expect(productIdsFromAgentMessage(message)).toEqual(['auroratech-smart-solar-solution']);
  });

  it('ignores a prose reply', () => {
    expect(productIdsFromAgentMessage('I could not find soler')).toEqual([]);
    expect(productIdsFromAgentMessage('')).toEqual([]);
    expect(productIdsFromAgentMessage(undefined)).toEqual([]);
  });

  it('caps the id list', () => {
    const products = Array.from({ length: 20 }, (_, index) => ({ productId: `product-${index}` }));
    const message = JSON.stringify({ data: { products } });

    expect(productIdsFromAgentMessage(message)).toHaveLength(12);
    expect(productIdsFromAgentMessage(message)[0]).toBe('product-0');
  });
});

describe('shouldTryProductRag', () => {
  it('skips blank and very short queries', () => {
    expect(shouldTryProductRag(undefined)).toBe(false);
    expect(shouldTryProductRag('  ')).toBe(false);
    expect(shouldTryProductRag('ab')).toBe(false);
    expect(shouldTryProductRag('sol')).toBe(true);
  });
});
