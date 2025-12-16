import { CheckoutRequest, CheckoutResponse, QuoteCheckoutRequest } from '../model/checkout';

/**
 * Interface for checkout service.
 * Defines methods for checkout operations.
 */
export interface CheckoutService {
  /**
   * Process a checkout for a cart
   * @param request Checkout request with cart details
   * @returns Promise with the checkout response containing order ID
   */
  checkout(request: CheckoutRequest): Promise<CheckoutResponse>;

  /**
   * Process a checkout approval
   * @param request Checkout request with cart details
   * @returns Promise with the checkout response containing order ID
   */
  checkoutApproval(request: CheckoutRequest): Promise<CheckoutResponse>;

  /**
   * Process a checkout from a quote
   * @param request Quote checkout request
   * @returns Promise with the checkout response containing order ID
   */
  checkoutFromQuote(request: QuoteCheckoutRequest): Promise<CheckoutResponse>;
}
