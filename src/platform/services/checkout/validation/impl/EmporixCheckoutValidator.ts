import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { ValidationResult } from '@/platform/services/validation';
import type { ValidationService } from '@/platform/services/validation';
import type { CheckoutRequest, QuoteCheckoutRequest } from '../../../model/checkout';
import type { CheckoutStep, CheckoutValidator } from '../CheckoutValidator';

/**
 * Implementation of CheckoutValidator for Emporix checkout
 */
@injectable('CheckoutValidator', 'Singleton')
class EmporixCheckoutValidator implements CheckoutValidator {
  constructor(
    @inject('ContactDataValidationService') private contactDataValidator: ValidationService,
    @inject('AddressValidationService') private addressValidator: ValidationService,
    @inject('ShippingValidationService') private shippingValidator: ValidationService,
    @inject('PaymentValidationService') private paymentValidator: ValidationService,
    @inject('SummaryValidationService') private summaryValidator: ValidationService,
  ) {}

  /**
   * Validate the complete checkout request
   * @param request The checkout request to validate
   * @returns Validation result with success flag and errors if any
   */
  validateCheckoutRequest(request: CheckoutRequest): ValidationResult<CheckoutRequest> {
    const errors: Record<string, string> = {};

    const stepsResult = this.validateSteps(request, ['addresses', 'shipping', 'payment', 'summary']);
    if (stepsResult.errors) {
      this.mergeErrors(stepsResult.errors, errors);
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, errors: errors };
    }

    return { success: true, data: request };
  }

  /**
   * Validate the complete checkout request
   * @param request The checkout request to validate
   * @returns Validation result with success flag and errors if any
   */
  validateGuestCheckoutRequest(request: CheckoutRequest): ValidationResult<CheckoutRequest> {
    const errors: Record<string, string> = {};
    if (!request.customer) {
      errors.customer = 'required';
    }

    const stepsResult = this.validateSteps(request, ['customer', 'addresses', 'shipping', 'payment', 'summary']);
    if (stepsResult.errors) {
      this.mergeErrors(stepsResult.errors, errors);
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, errors: errors };
    }

    return { success: true, data: request };
  }

  /**
   * Validate a quote checkout request
   * @param request The quote checkout request to validate
   * @returns Validation result with success flag and errors if any
   */
  validateQuoteCheckoutRequest(_request: QuoteCheckoutRequest): ValidationResult<QuoteCheckoutRequest> {
    throw new Error('Not implemented');
  }

  protected validateSteps(request: CheckoutRequest, steps: CheckoutStep[]): ValidationResult<CheckoutRequest> {
    const errors: Record<string, string> = {};

    steps.forEach((step) => {
      let result: ValidationResult<any>;
      switch (step) {
        case 'customer':
          result = this.validateCustomer(request.customer);
          break;
        case 'addresses':
          result = this.validateAddresses(request.addresses);
          break;
        case 'shipping':
          result = this.validateShipping(request.shipping);
          break;
        case 'payment':
          result = this.validatePayment(request.paymentMethod);
          break;
        case 'summary':
          result = this.validateSummary(request.summary);
          break;
      }
      if (result.errors) {
        this.mergeErrors(result.errors, errors, step);
      }
    });

    if (Object.keys(errors).length > 0) {
      return { success: false, errors: errors };
    }

    return { success: true, data: request };
  }

  /**
   * Validate a specific checkout step
   * @param step The checkout step to validate
   * @param data The data for the specific step
   * @returns Validation result with success flag and errors if any
   */
  validateCheckoutStep<T>(step: CheckoutStep, data: any): ValidationResult<T> {
    switch (step) {
      case 'customer':
        return this.validateCustomer(data);
      case 'addresses':
        return this.validateAddresses(data);
      case 'shipping':
        return this.validateShipping(data);
      case 'payment':
        return this.validatePayment(data);
      case 'summary':
        return this.validateSummary(data);
      default:
        throw new Error(`Unknown checkout step: ${step}`);
    }
  }

  /**
   * Validate customer data
   * @param data The customer data to validate
   * @returns Validation result
   */
  private validateCustomer<T>(data: any): ValidationResult<T> {
    return this.contactDataValidator.validate(data);
  }

  /**
   * Validate addresses
   * @param data The addresses to validate
   * @returns Validation result
   */
  private validateAddresses<T>(data: any): ValidationResult<T> {
    // For arrays, validate each item
    if (Array.isArray(data)) {
      // Validate each address and collect errors
      const errors: Record<string, string> = {};
      let isValid = true;

      data.forEach((address, index) => {
        const result = this.addressValidator.validate(address);
        if (!result.success) {
          isValid = false;
          // Add errors with index prefix
          Object.entries(result.errors || {}).forEach(([key, value]) => {
            errors[`${index}.${key}`] = String(value);
          });
        }
      });

      return {
        success: isValid,
        errors: isValid ? undefined : errors,
        data: isValid ? (data as T) : undefined,
      };
    }

    // Single address validation
    return this.addressValidator.validate(data);
  }

  /**
   * Validate shipping method
   * @param data The shipping method to validate
   * @returns Validation result
   */
  private validateShipping<T>(data: any): ValidationResult<T> {
    return this.shippingValidator.validate(data);
  }

  /**
   * Validate payment method
   * @param data The payment method to validate
   * @returns Validation result
   */
  private validatePayment<T>(data: any): ValidationResult<T> {
    return this.paymentValidator.validate(data);
  }

  private validateSummary<T>(data: any): ValidationResult<T> {
    return this.summaryValidator.validate(data);
  }

  private mergeErrors(errors: Record<string, string>, into: Record<string, string>, prefix?: string) {
    Object.entries(errors).forEach(([key, value]) => {
      if (prefix) {
        into[`${prefix}.${key}`] = String(value);
      } else {
        into[key] = String(value);
      }
    });
  }
}

export default EmporixCheckoutValidator;
