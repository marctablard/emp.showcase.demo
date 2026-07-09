import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCustomerSegmentApi } from '@/platform/integrations/emporix/customer-segment/EmporixCustomerSegmentApi';
import type { ItemAssignmentResponse } from '@/platform/integrations/emporix/model';
import type { CustomerService } from '../../customer/CustomerService';
import type { LoggerService } from '../../logger/LoggerService';
import type { Category } from '../../model/category';
import type { CategoryTreeNode, CustomerSegmentQueryOptions, ItemAssignment } from '../../model/customer-segment';
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
    const session = await this.sessionService.getCurrent();
    const customer = await this.customerService.getCustomer();
    try {
      const params = {
        legalEntityId: options?.legalEntityId ?? customer?.legalEntityId,
        siteCode: options?.siteCode ?? session?.siteCode,
      };

      const response = await this.customerSegmentApi.getCategoryTrees(params);
      const trees = this.customerSegmentMapper.mapCategoryTrees(response);
      const prunedTrees = this.pruneSegmentCategoryTree(trees);
      return prunedTrees.map((tree) => this.mapCategoryTreeNodeToCategory(tree));
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

  private mapCategoryTreeNodeToCategory(node: CategoryTreeNode): Category {
    return {
      id: node.id,
      name: node.name,
      description: node.description,
      published: node.published,
      position: node.position,
      parent: node.parentId,
      children: node.subcategories.map((child) => this.mapCategoryTreeNodeToCategory(child)),
    };
  }

  /**
   * Keeps categories that are segment-assigned or contain segment-assigned descendants.
   */
  private pruneSegmentCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
    return nodes.flatMap((node) => {
      const prunedChildren = this.pruneSegmentCategoryTree(node.subcategories);
      if (node.assignedToSegment || prunedChildren.length > 0) {
        return [{ ...node, subcategories: prunedChildren }];
      }
      return [];
    });
  }
}

export default EmporixCustomerSegmentService;
