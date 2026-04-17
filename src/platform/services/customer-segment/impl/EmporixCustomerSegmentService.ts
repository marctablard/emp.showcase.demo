import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerSegmentApi } from '@/platform/integrations/emporix/customer-segment/EmporixCustomerSegmentApi';
import type { CategoryTreeItemResponse, ItemAssignmentResponse } from '@/platform/integrations/emporix/model';
import type { CustomerService } from '../../customer/CustomerService';
import type { LoggerService } from '../../logger/LoggerService';
import type { Category } from '../../model/category';
import type { CustomerSegmentQueryOptions, ItemAssignment } from '../../model/customer-segment';
import type { CustomerSegmentMapper } from '../../model/customer-segment/CustomerSegmentMapper';
import type { SessionService } from '../../session';
import type { CustomerSegmentService } from '../CustomerSegmentService';

@injectable('CustomerSegmentService', 'Singleton')
export class EmporixCustomerSegmentService implements CustomerSegmentService {
  private sessionService: SessionService;
  private customerService: CustomerService;

  constructor(
    @inject('EmporixCustomerSegmentApi') private customerSegmentApi: EmporixCustomerSegmentApi,
    @inject('EmporixCustomerSegmentMapper') private customerSegmentMapper: CustomerSegmentMapper,
    @inject('SessionService') sessionService: SessionService,
    @inject('CustomerService') customerService: CustomerService,
    @inject('LoggerService') private logger: LoggerService,
  ) {
    this.sessionService = sessionService;
    this.customerService = customerService;
  }

  async getSegmentItems(options?: CustomerSegmentQueryOptions): Promise<ItemAssignment[]> {
    const session = await this.sessionService.getCurrent();
    const customer = await this.customerService.getCustomer();
    try {
      options = {
        ...options,
        siteCode: session?.siteCode,
        legalEntityId: customer?.legalEntityId,
        onlyActive: true,
      };
      const response = await this.customerSegmentApi.getSegmentItems(options);

      // Map API response to service model using dedicated mapper
      return response.map(
        (item: ItemAssignmentResponse): ItemAssignment => this.customerSegmentMapper.mapToService(item),
      );
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
        },
        'Error fetching customer segment items',
      );
      throw new Error(
        `Failed to retrieve customer segment items: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getCategoryTrees(options?: CustomerSegmentQueryOptions): Promise<Category[]> {
    try {
      const params = {
        legalEntityId: options?.legalEntityId,
      };

      const response = await this.customerSegmentApi.getCategoryTrees(params);

      return response.map(
        (item: CategoryTreeItemResponse): Category => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.localizedDescription,
          slug: item.localizedSlug,
        }),
      );
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
        },
        'Error fetching customer segment category trees',
      );
      throw new Error(
        `Failed to retrieve customer segment category trees: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

export default EmporixCustomerSegmentService;
