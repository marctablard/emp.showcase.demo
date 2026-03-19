import { injectable } from '@/platform/core/di/injectable';
import { EmporixMetadata } from '@/platform/integrations/emporix/model/common';
import {
  EmporixReturnAssistedBuyingEntry,
  EmporixReturnCalculatedPrice,
  EmporixReturnCalculatedValue,
  EmporixReturnOrder,
  EmporixReturnOrderItem,
  EmporixReturnPrice,
  EmporixReturnReason,
  EmporixReturnRequestor,
  EmporixReturnResponse,
  EmporixReturnSubmitter,
} from '@/platform/integrations/emporix/model/return';
import {
  Return,
  ReturnAssistedBuyingEntry,
  ReturnCalculatedPrice,
  ReturnCalculatedValue,
  ReturnItem,
  ReturnMetadata,
  ReturnOrder,
  ReturnPrice,
  ReturnReason,
  ReturnRequestor,
  ReturnSubmitter,
} from '@/platform/services/model/return';
import { ReturnMapper } from '../ReturnMapper';

/**
 * Implementation of ReturnMapper for Emporix return data.
 * Maps between Emporix API return format and internal Return model.
 */
@injectable('EmporixReturnMapper', 'Singleton')
export class EmporixReturnMapper implements ReturnMapper<EmporixReturnResponse> {
  private mapOptional<S, T>(value: S | undefined, mapper: (v: S) => T): T | undefined {
    return value === undefined ? undefined : mapper(value);
  }

  /**
   * Maps an Emporix return to the internal Return model.
   *
   * @param source - The Emporix return data
   * @returns The internal Return model
   */
  mapToService(source: EmporixReturnResponse): Return {
    const isExpired = this.calculateIsExpired(source.expiryDate);

    return {
      id: source.id,
      status: source.approvalStatus,
      approvalStatus: source.approvalStatus,
      received: source.received ?? false,
      expiryDate: source.expiryDate,
      isExpired,
      total: this.mapOptional(source.total, this.mapPrice),
      calculatedPrice: this.mapOptional(source.calculatedPrice, (value) => this.mapCalculatedPrice(value)),
      reason: this.mapOptional(source.reason, this.mapReason),
      orders: this.mapOrders(source.orders),
      requestor: this.mapOptional(source.requestor, this.mapRequestor),
      submitter: this.mapOptional(source.submitter, this.mapSubmitter),
      entries: this.mapOptional(source.entries, (value) => this.mapEntries(value)),
      metadata: this.mapOptional(source.metadata, this.mapMetadata),
      mixins: this.mapOptional(source.mixins, this.mapMixins),
      createdAt: source.metadata?.createdAt,
      updatedAt: source.metadata?.modifiedAt,
    };
  }

  /**
   * Maps an internal Return model back to Emporix return format.
   * Note: This is not typically used as returns are read-only in this context.
   *
   * @param service - The internal Return model
   * @returns The Emporix return data
   */
  mapToSource(service: Return): EmporixReturnResponse {
    return {
      id: service.id,
      approvalStatus: service.status,
      received: service.received,
      expiryDate: service.expiryDate,
      total: this.mapOptional(service.total, this.mapPriceToSource),
      calculatedPrice: this.mapOptional(service.calculatedPrice, (value) => this.mapCalculatedPriceToSource(value)),
      reason: this.mapOptional(service.reason, this.mapReasonToSource),
      orders: this.mapOrdersToSource(service.orders),
      requestor: this.mapOptional(service.requestor, this.mapRequestorToSource),
      submitter: this.mapOptional(service.submitter, this.mapSubmitterToSource),
      entries: this.mapOptional(service.entries, (value) => this.mapEntriesToSource(value)),
      metadata: service.metadata
        ? this.mapMetadataToSource(service.metadata)
        : {
            createdAt: service.createdAt,
            modifiedAt: service.updatedAt,
          },
      mixins: this.mapOptional(service.mixins, this.mapMixinsToSource),
    };
  }

  /**
   * Calculates if the return has expired based on expiryDate.
   */
  private calculateIsExpired(expiryDate?: string): boolean {
    if (!expiryDate) {
      return false;
    }
    try {
      const expiry = new Date(expiryDate);
      const now = new Date();
      return expiry < now;
    } catch {
      return false;
    }
  }

  /**
   * Maps Emporix price to service price.
   */
  private mapPrice(source: EmporixReturnPrice): ReturnPrice {
    return {
      value: source.value,
      currency: source.currency,
    };
  }

  /**
   * Maps service price to Emporix price.
   */
  private mapPriceToSource(service: ReturnPrice): EmporixReturnPrice {
    return {
      value: service.value,
      currency: service.currency,
    };
  }

  private mapCalculatedValue(source: EmporixReturnCalculatedValue, currency?: string): ReturnCalculatedValue {
    return {
      netValue: source.netValue,
      grossValue: source.grossValue,
      taxValue: source.taxValue,
      taxCode: source.taxCode,
      taxRate: source.taxRate,
      valid: source.valid,
      currency: source.currency ?? currency,
    };
  }

  private mapCalculatedValueToSource(service: ReturnCalculatedValue): EmporixReturnCalculatedValue {
    return {
      netValue: service.netValue,
      grossValue: service.grossValue,
      taxValue: service.taxValue,
      taxCode: service.taxCode,
      taxRate: service.taxRate,
      valid: service.valid,
      currency: service.currency,
    };
  }

  private mapCalculatedPrice(source: EmporixReturnCalculatedPrice, currency?: string): ReturnCalculatedPrice {
    return {
      finalPrice: this.mapCalculatedValue(source.finalPrice, currency),
    };
  }

  private mapCalculatedPriceToSource(service: ReturnCalculatedPrice): EmporixReturnCalculatedPrice {
    return {
      finalPrice: this.mapCalculatedValueToSource(service.finalPrice),
    };
  }

  /**
   * Maps Emporix reason to service reason.
   */
  private mapReason(source: EmporixReturnReason): ReturnReason {
    return {
      code: source.code,
      details: source.details,
    };
  }

  /**
   * Maps service reason to Emporix reason.
   */
  private mapReasonToSource(service: ReturnReason): EmporixReturnReason {
    return {
      code: service.code,
      details: service.details,
    };
  }

  /**
   * Maps Emporix orders array to service orders.
   */
  private mapOrders(orders?: EmporixReturnOrder[]): ReturnOrder[] {
    return orders?.map((order) => this.mapOrder(order)) ?? [];
  }

  /**
   * Maps a single Emporix order to service order.
   */
  private mapOrder(source: EmporixReturnOrder): ReturnOrder {
    return {
      id: source.id,
      items: this.mapItems(source.items),
    };
  }

  /**
   * Maps service orders to Emporix orders.
   */
  private mapOrdersToSource(orders: ReturnOrder[]): EmporixReturnOrder[] {
    return orders.map((order) => ({
      id: order.id,
      items: this.mapItemsToSource(order.items),
    }));
  }

  /**
   * Maps Emporix items array to service items.
   */
  private mapItems(items?: EmporixReturnOrderItem[]): ReturnItem[] {
    return items?.map((item) => this.mapItem(item)) ?? [];
  }

  /**
   * Maps a single Emporix item to service item.
   */
  private mapItem(source: EmporixReturnOrderItem): ReturnItem {
    return {
      id: source.id,
      name: source.name,
      quantity: source.quantity,
      unitPrice: this.mapOptional(source.unitPrice, this.mapPrice),
      total: this.mapOptional(source.total, this.mapPrice),
      calculatedUnitPrice: this.mapOptional(source.calculatedUnitPrice, (value) =>
        this.mapCalculatedValue(value, source.unitPrice?.currency ?? source.total?.currency),
      ),
      calculatedPrice: this.mapOptional(source.calculatedPrice, (value) =>
        this.mapCalculatedPrice(value, source.total?.currency),
      ),
      reason: this.mapOptional(source.reason, this.mapReason),
    };
  }

  /**
   * Maps service items to Emporix items.
   */
  private mapItemsToSource(items: ReturnItem[]): EmporixReturnOrderItem[] {
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: this.mapOptional(item.unitPrice, this.mapPriceToSource),
      total: this.mapOptional(item.total, this.mapPriceToSource),
      calculatedUnitPrice: this.mapOptional(item.calculatedUnitPrice, this.mapCalculatedValueToSource),
      calculatedPrice: this.mapOptional(item.calculatedPrice, this.mapCalculatedPriceToSource),
      reason: this.mapOptional(item.reason, this.mapReasonToSource),
    }));
  }

  /**
   * Maps Emporix requestor to service requestor.
   */
  private mapRequestor(source: EmporixReturnRequestor): ReturnRequestor {
    const firstName = source.firstName ?? '';
    const lastName = source.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

    return {
      customerId: source.customerId,
      firstName: source.firstName,
      lastName: source.lastName,
      email: source.email,
      anonymous: source.anonymous,
      fullName,
    };
  }

  /**
   * Maps service requestor to Emporix requestor.
   */
  private mapRequestorToSource(service: ReturnRequestor): EmporixReturnRequestor {
    return {
      customerId: service.customerId,
      firstName: service.firstName,
      lastName: service.lastName,
      email: service.email,
      anonymous: service.anonymous,
    };
  }

  private mapSubmitter(source: EmporixReturnSubmitter): ReturnSubmitter {
    return {
      userType: source.userType,
      firstName: source.firstName,
      lastName: source.lastName,
      email: source.email,
    };
  }

  private mapSubmitterToSource(service: ReturnSubmitter): EmporixReturnSubmitter {
    return {
      userType: service.userType,
      firstName: service.firstName,
      lastName: service.lastName,
      email: service.email,
    };
  }

  private mapEntries(source: EmporixReturnAssistedBuyingEntry[]): ReturnAssistedBuyingEntry[] {
    return source.map((entry) => ({
      employeeId: entry.employeeId,
      operation: entry.operation,
      timestamp: entry.timestamp,
    }));
  }

  private mapEntriesToSource(service: ReturnAssistedBuyingEntry[]): EmporixReturnAssistedBuyingEntry[] {
    return service.map((entry) => ({
      employeeId: entry.employeeId,
      operation: entry.operation,
      timestamp: entry.timestamp,
    }));
  }

  private mapMetadata(source: EmporixMetadata): ReturnMetadata {
    return { ...source };
  }

  private mapMetadataToSource(service: ReturnMetadata): EmporixMetadata {
    return { ...service };
  }

  private mapMixins(source: Record<string, unknown>): Record<string, unknown> {
    return { ...source };
  }

  private mapMixinsToSource(service: Record<string, unknown>): Record<string, unknown> {
    return { ...service };
  }
}

export default EmporixReturnMapper;
