import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixReturnCreateRequest } from '@/platform/integrations/emporix/model/return';
import type { EmporixReturnApi } from '@/platform/integrations/emporix/return/EmporixReturnApi';
import type { Return } from '@/platform/services/model/return';
import type { EmporixReturnMapper } from '@/platform/services/model/return/impl/EmporixReturnMapper';
import type { CreateReturnItem, ReturnListResult, ReturnService } from '../ReturnService';

/**
 * Implementation of ReturnService interface for Emporix return operations.
 */
@injectable('ReturnService', 'Singleton')
export class EmporixReturnService implements ReturnService {
  constructor(
    @inject('EmporixReturnApi') private returnApi: EmporixReturnApi,
    @inject('EmporixReturnMapper') private returnMapper: EmporixReturnMapper,
  ) {}

  /**
   * Get all returns for the current user
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with array of returns
   */
  async listReturns(
    pageNumber: number = 1,
    pageSize: number = 60,
    sort?: string,
    query?: string,
  ): Promise<ReturnListResult> {
    const emporixReturns = await this.returnApi.getReturns(pageNumber, pageSize, sort, query);
    return {
      items: emporixReturns.items.map((returnItem) => this.returnMapper.mapToService(returnItem)),
      totalCount: emporixReturns.totalCount,
    };
  }

  async getReturns(pageNumber: number = 1, pageSize: number = 60, sort?: string, query?: string): Promise<Return[]> {
    const { items } = await this.listReturns(pageNumber, pageSize, sort, query);
    return items;
  }

  /**
   * Get a specific return by ID
   * @param returnId The ID of the return to retrieve
   * @returns Promise with the return or undefined if not found
   */
  async getReturn(returnId: string): Promise<Return | undefined> {
    const emporixReturn = await this.returnApi.getReturn(returnId);
    if (!emporixReturn) {
      return undefined;
    }
    return this.returnMapper.mapToService(emporixReturn);
  }

  /**
   * Create a new return for an order
   * @param orderId The ID of the order to create return for
   * @param items Array of items to return with quantities
   * @param reasonCode The reason code for the return (mandatory per Emporix API)
   * @returns Promise with the created return ID
   */
  async createReturn(
    orderId: string,
    items: CreateReturnItem[],
    reasonCode: string,
    reasonDetails?: string,
  ): Promise<string> {
    const request: EmporixReturnCreateRequest = {
      orders: [
        {
          id: orderId,
          items: items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            reason: item.reason,
          })),
        },
      ],
      reason: {
        code: reasonCode,
        details: reasonDetails,
      },
    };

    const result = await this.returnApi.createReturn(request);
    return result.id;
  }
}

export default EmporixReturnService;
