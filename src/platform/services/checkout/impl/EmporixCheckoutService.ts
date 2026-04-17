import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCheckoutApi } from '@/platform/integrations/emporix/checkout/EmporixCheckoutApi';
import type {
  EmporixCartCheckoutRequest,
  EmporixCheckoutCustomer,
  EmporixCheckoutPaymentMethod,
} from '@/platform/integrations/emporix/model';
import type EmporixPaymentGatewayApi from '@/platform/integrations/emporix/payment/impl/EmporixPaymentGatewayApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type {
  CheckoutPaymentMethod,
  CheckoutRequest,
  CheckoutResponse,
  QuoteCheckoutRequest,
} from '../../model/checkout';
import type EmporixCheckoutMapper from '../../model/checkout/impl/EmporixCheckoutMapper';
import type { CheckoutService } from '../CheckoutService';
import type { CheckoutValidator } from '../validation/CheckoutValidator';

/**
 * Implementation of CheckoutService for Emporix checkout.
 * Maps between Emporix API checkout format and internal Checkout model.
 */
@injectable('CheckoutService', 'Singleton')
class EmporixCheckoutService implements CheckoutService {
  constructor(
    @inject('EmporixCheckoutApi') private checkoutApi: EmporixCheckoutApi,
    @inject('EmporixPaymentGatewayApi') private paymentGatewayApi: EmporixPaymentGatewayApi,
    @inject('CustomerService') private customerService: CustomerService,
    @inject('CheckoutValidator') private checkoutValidator: CheckoutValidator,
    @inject('EmporixCheckoutMapper') private checkoutMapper: EmporixCheckoutMapper,
  ) {}

  async checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    const { emporixCustomer, guest } = await this.buildEmporixCustomer(request);
    const checkoutRequest = await this.buildCheckoutRequest(request, emporixCustomer);
    return this.performCheckout(checkoutRequest, guest);
  }

  async checkoutApproval(request: CheckoutRequest): Promise<CheckoutResponse> {
    const forcedContact = request.customer;
    if (!forcedContact) {
      throw new Error('Customer data is required for checkout approval');
    }
    const { emporixCustomer } = await this.buildEmporixCustomer(request, forcedContact);
    const checkoutRequest = await this.buildCheckoutRequest(request, emporixCustomer);
    // Approval checkout is always non-guest
    return this.performCheckout(checkoutRequest, false);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkoutFromQuote(request: QuoteCheckoutRequest): Promise<CheckoutResponse> {
    throw new Error('Not implemented');
    /*
    // Map service model to API model
    const apiRequest = this.mapper.mapQuoteToApi(request);
    
    // Call the API
    const apiResponse = await this.checkoutApi.checkoutFromQuote(apiRequest);
    
    // Map API response to service model
    return this.mapper.mapToService(apiResponse);
    */
  }

  private async buildEmporixCustomer(
    request: CheckoutRequest,
    checkoutCustomer?: CheckoutRequest['customer'],
  ): Promise<{ emporixCustomer: EmporixCheckoutCustomer; guest: boolean }> {
    // If approval flow provides explicit customer, treat as non-guest
    if (checkoutCustomer) {
      const { userId, email, firstName, lastName, company } = checkoutCustomer;
      return {
        emporixCustomer: {
          id: userId,
          email,
          firstName,
          lastName,
          company,
          guest: false,
        },
        guest: false,
      };
    }

    const customer = await this.customerService.getCustomer();
    if (!customer) {
      const result = this.checkoutValidator.validateGuestCheckoutRequest(request);
      if (!result.success) {
        throw new Error('Checkout Validation Failed!', {
          cause: result.errors,
        });
      }
      if (!request.customer) {
        throw new Error('Contact Data is required for guest checkout');
      }
      const { email, firstName, lastName, company } = request.customer;
      return {
        emporixCustomer: {
          email,
          firstName,
          lastName,
          company,
          guest: true,
        },
        guest: true,
      };
    }

    const result = this.checkoutValidator.validateCheckoutRequest(request);
    if (!result.success) {
      throw new Error('Checkout Validation Failed!', {
        cause: result.errors,
      });
    }
    return {
      emporixCustomer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        company: customer.company,
        guest: false,
      },
      guest: false,
    };
  }

  private async buildCheckoutRequest(
    request: CheckoutRequest,
    emporixCustomer: EmporixCheckoutCustomer,
  ): Promise<EmporixCartCheckoutRequest> {
    const paymentMethods = [await this.getCheckoutPaymentMethod(request.paymentMethod)];
    return this.checkoutMapper.mapCartCheckoutToSource(request, emporixCustomer, paymentMethods);
  }

  private async performCheckout(
    checkoutRequest: EmporixCartCheckoutRequest,
    guest: boolean,
  ): Promise<CheckoutResponse> {
    if (guest) {
      return this.checkoutApi.guestCheckout(checkoutRequest);
    }
    return this.checkoutApi.checkout(checkoutRequest);
  }

  private async getCheckoutPaymentMethod(paymentMethod: CheckoutPaymentMethod): Promise<EmporixCheckoutPaymentMethod> {
    const emporixPaymentMode = await this.paymentGatewayApi.getPaymentMode(paymentMethod.id);
    if (!emporixPaymentMode) {
      throw new Error('Failed to get payment mode');
    }
    return {
      provider: emporixPaymentMode.provider,
      method: emporixPaymentMode.code,
      amount: paymentMethod.amount,
      customAttributes: paymentMethod.customAttributes,
    };
  }
}

export default EmporixCheckoutService;
