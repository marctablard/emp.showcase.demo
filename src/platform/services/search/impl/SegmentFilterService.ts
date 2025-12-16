import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { CustomerSegmentService } from '../../customer-segment/CustomerSegmentService';
import type { CustomerService } from '../../customer/CustomerService';

/**
 * Shared service for filtering products and suggestions by customer segments
 * Used by both BatteryIncludedSearchService and EmporixSearchService
 */
@injectable('SegmentFilterService', 'Singleton')
class SegmentFilterService {
  private customerSegmentService: CustomerSegmentService;
  private categoryApi: EmporixCategoryApi;
  private customerService: CustomerService;

  constructor(
    @inject('CustomerSegmentService') customerSegmentService: CustomerSegmentService,
    @inject('EmporixCategoryApi') categoryApi: EmporixCategoryApi,
    @inject('CustomerService') customerService: CustomerService,
  ) {
    this.customerSegmentService = customerSegmentService;
    this.categoryApi = categoryApi;
    this.customerService = customerService;
  }

  private async getSegmentItems(): Promise<any[]> {
    return this.customerSegmentService.getSegmentItems();
  }

  async getAllowedProductIds(): Promise<Set<string>> {
    return this.computeAllowedProductIds();
  }

  async getSegmentIds(): Promise<string[]> {
    const segmentItems = await this.getSegmentItems();
    const segmentIds = new Set<string>();
    segmentItems.forEach((item) => {
      if (item.segmentId) {
        segmentIds.add(item.segmentId);
      }
    });
    return Array.from(segmentIds);
  }

  async filterByCustomerSegments<T extends { id?: string }>(items: T[]): Promise<T[]> {
    const currentCustomer = await this.customerService.getCustomer();
    if (!currentCustomer) return items;

    const segmentIds = await this.getSegmentIds();
    if (segmentIds.length === 0) return items;

    const allowedProductIds = await this.getAllowedProductIds();
    if (allowedProductIds.size === 0) return items;

    return items.filter((item) => allowedProductIds.has(item.id!));
  }

  /**
   * Filters suggestions response by customer segments
   * Maintains the original response structure while filtering hits
   */
  async filterSuggestions(suggestions: any[]): Promise<any[]> {
    const segmentItems = await this.getSegmentItems();
    const allAllowedProductIds = await this.getAllowedProductIds();

    return suggestions.map((item) => {
      if (item.kind === 'document' && Array.isArray(item.hits)) {
        return {
          ...item,
          hits: item.hits.filter((hit: any) => {
            if (!hit.highlighted) return false;
            const highlighted = hit.highlighted;
            return allAllowedProductIds.has(highlighted.id);
          }),
        };
      }

      if (item.kind === 'facet.categoryAssignments.name' && Array.isArray(item.hits)) {
        return {
          ...item,
          hits: item.hits.filter((hit: any) => {
            return segmentItems.some((segmentItem) => {
              if (segmentItem.type === 'CATEGORY' && segmentItem.item.name === hit.value) {
                return true;
              }
              return false;
            });
          }),
        };
      }
      return item;
    });
  }

  private async computeAllowedProductIds(): Promise<Set<string>> {
    const segmentItems = await this.getSegmentItems();
    const allProductIds = new Set<string>();

    for (const segmentItem of segmentItems) {
      if (segmentItem.type === 'PRODUCT') {
        allProductIds.add(segmentItem.item.id);
      } else if (segmentItem.type === 'CATEGORY') {
        try {
          const assignments = await this.categoryApi.getCategoryAssignments(segmentItem.item.id, {
            page: 1,
            size: 9999,
            criteria: {
              assignmentType: 'PRODUCT',
              segmentIds: segmentItem.segmentId,
            },
          });

          assignments.items?.forEach((assignment: any) => {
            if (assignment.ref?.id) {
              allProductIds.add(assignment.ref.id);
            }
          });
        } catch (error) {
          console.error(`Error fetching category assignments for ${segmentItem.item.id}:`, error);
        }
      }
    }

    return allProductIds;
  }
}

export default SegmentFilterService;
