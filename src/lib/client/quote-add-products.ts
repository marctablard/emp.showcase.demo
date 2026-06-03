export interface AddProductsToQuoteItem {
  productId: string;
  quantity: number;
}

export interface AddProductsToQuoteResult {
  success: boolean;
  addedCount?: number;
  error?: string;
  failures?: Array<{ productId: string; status: number; message: string }>;
}

export async function addProductsToQuote(
  quoteId: string,
  items: AddProductsToQuoteItem[],
): Promise<AddProductsToQuoteResult> {
  const response = await fetch('/api/quote/add-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, items }),
  });

  const data = (await response.json().catch(() => ({}))) as AddProductsToQuoteResult & {
    error?: string;
    failures?: AddProductsToQuoteResult['failures'];
    addedCount?: number;
  };

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to add products to quote',
      failures: data.failures,
      addedCount: data.addedCount,
    };
  }

  return { success: true, addedCount: data.addedCount ?? items.length };
}
