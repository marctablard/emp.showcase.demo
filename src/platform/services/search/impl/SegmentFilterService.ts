import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
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
  private logger: LoggerService;

  constructor(
    @inject('CustomerSegmentService') customerSegmentService: CustomerSegmentService,
    @inject('EmporixCategoryApi') categoryApi: EmporixCategoryApi,
    @inject('CustomerService') customerService: CustomerService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.customerSegmentService = customerSegmentService;
    this.categoryApi = categoryApi;
    this.customerService = customerService;
    this.logger = logger;
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
    try {
      const currentCustomer = await this.customerService.getCustomer();
      if (!currentCustomer) return items;

      const segmentIds = await this.getSegmentIds();
      if (segmentIds.length === 0) return items;

      const allowedProductIds = await this.getAllowedProductIds();
      if (allowedProductIds.size === 0) return items;

      return items.filter((item) => allowedProductIds.has(item.id!));
    } catch (error) {
      // Segment resolution is a best-effort restriction layer. If it fails (e.g. the
      // customer-segment API is unavailable or not enabled for the tenant/legal entity),
      // fall back to the unfiltered items instead of failing the entire product search.
      this.logger.warn(
        { err: error instanceof Error ? error : String(error) },
        'Customer segment filtering failed; returning unfiltered results',
      );
      return items;
    }
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
              withSubcategories: true,
              segmentsIds: segmentItem.segmentId,
            },
          });

          assignments.items?.forEach((assignment: any) => {
            if (assignment.ref?.id) {
              allProductIds.add(assignment.ref.id);
            }
          });
        } catch (error) {
          this.logger.error(
            {
              err: error,
              categoryId: segmentItem.item.id,
            },
            `Error fetching category assignments for ${segmentItem.item.id}`,
          );
        }
      }
    }

    return allProductIds;
  }
}

export default SegmentFilterService;
