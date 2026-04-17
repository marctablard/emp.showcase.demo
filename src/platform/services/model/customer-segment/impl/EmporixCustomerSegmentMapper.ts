import { injectable } from '@/platform/core/di/injectable';
import type { ItemAssignmentResponse } from '@/platform/integrations/emporix/model';
import type { CategoryTree, CategoryTreeNode, ItemAssignment } from '@/platform/services/model/customer-segment';
import type { CustomerSegmentMapper } from '../CustomerSegmentMapper';

/**
 * Maps Emporix ItemAssignmentResponse to internal ItemAssignment model.
 */
@injectable('EmporixCustomerSegmentMapper', 'Singleton')
class EmporixCustomerSegmentMapper implements CustomerSegmentMapper {
  mapToService(source: ItemAssignmentResponse): ItemAssignment {
    return {
      segmentId: source.segmentId,
      item: {
        id: source.item.id,
        code: source.item.code,
        name: source.item.name,
      },
      type: source.type,
      metadata: {
        createdAt: source.metadata.createdAt,
        modifiedAt: source.metadata.modifiedAt,
        version: typeof source.metadata.version === 'number' ? source.metadata.version : undefined,
        ...source.metadata,
      },
      mixins: (source.metadata?.mixins as any) ?? undefined,
    };
  }

  mapCategoryTrees(source: any[]): CategoryTree[] {
    return source.map((category) => this.mapCategoryTreeNode(category));
  }

  private mapCategoryTreeNode(source: any): CategoryTreeNode {
    return {
      id: source.id,
      parentId: source.parentId,
      name: source.name || {},
      description: source.localizedDescription || {},
      position: source.position || 0,
      published: source.published || false,
      assignedToSegment: source.assignedToSegment || false,
      subcategories: source.subcategories ? source.subcategories.map((sub: any) => this.mapCategoryTreeNode(sub)) : [],
    };
  }

  mapToSource(_service: ItemAssignment): ItemAssignmentResponse {
    throw new Error('Method not implemented.');
  }
}

export default EmporixCustomerSegmentMapper;
