import { injectable } from '@/platform/core/di/injectable';
import type {
  CategoryTreeItemResponse,
  ItemAssignmentResponse,
  SegmentResponse,
} from '@/platform/integrations/emporix/model';
import type {
  CategoryTree,
  CategoryTreeNode,
  ItemAssignment,
  Segment,
} from '@/platform/services/model/customer-segment';
import type { CustomerSegmentMapper } from '../CustomerSegmentMapper';

/**
 * Maps Emporix customer-segment responses (item assignments, segments, category trees)
 * to the internal service models.
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

  mapSegment(source: SegmentResponse): Segment | undefined {
    if (!source || typeof source.id !== 'string') {
      return undefined;
    }

    const segment: Segment = { id: source.id };
    if (source.name && typeof source.name === 'object') {
      segment.name = source.name;
    }
    if (typeof source.status === 'string') {
      segment.status = source.status;
    }
    if (typeof source.siteCode === 'string') {
      segment.siteCode = source.siteCode;
    }
    if (source.validity && typeof source.validity === 'object') {
      segment.validity = {
        from: typeof source.validity.from === 'string' ? source.validity.from : undefined,
        to: typeof source.validity.to === 'string' ? source.validity.to : undefined,
      };
    }
    return segment;
  }

  mapCategoryTrees(source: CategoryTreeItemResponse[]): CategoryTree[] {
    return source.map((category) => this.mapCategoryTreeNode(category));
  }

  private mapCategoryTreeNode(source: CategoryTreeItemResponse, parentId?: string): CategoryTreeNode {
    return {
      id: source.id,
      parentId,
      name: source.name ?? {},
      description: source.localizedDescription ?? {},
      position: source.position ?? 0,
      published: source.published ?? false,
      assignedToSegment: source.isSegmentAssigned ?? false,
      subcategories: (source.subcategories ?? []).map((sub) => this.mapCategoryTreeNode(sub, source.id)),
    };
  }

  mapToSource(_service: ItemAssignment): ItemAssignmentResponse {
    throw new Error('Method not implemented.');
  }
}

export default EmporixCustomerSegmentMapper;
