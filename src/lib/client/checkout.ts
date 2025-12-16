import type { CheckoutRequest, CheckoutResponse, QuoteCheckoutRequest } from '@/platform/services/model/checkout';

/**
 * Process a checkout for a cart
 * @param request Checkout request with cart details
 * @returns Promise with the checkout response containing order ID
 */
export async function checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Failed to process checkout');
  }

  return response.json();
}

/**
 * Process a checkout approval
 * @param request Checkout request with cart details
 * @returns Promise with the checkout response containing order ID
 */
export async function checkoutApproval(request: CheckoutRequest): Promise<CheckoutResponse> {
  const response = await fetch('/api/checkout/approval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Failed to process checkout approval');
  }

  return response.json();
}

/**
 * Process a checkout from a quote
 * @param request Quote checkout request
 * @returns Promise with the checkout response containing order ID
 */
export async function checkoutFromQuote(request: QuoteCheckoutRequest): Promise<CheckoutResponse> {
  const response = await fetch('/api/checkout/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || 'Failed to process quote checkout');
  }

  return response.json();
}
