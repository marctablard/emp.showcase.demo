import { EmporixLocalizedString, EmporixMedia, EmporixMetadata, EmporixMixins } from './common';

export interface EmporixCategory {
  id: string;
  code?: string;
  name: EmporixLocalizedString;
  description?: EmporixLocalizedString;
  shortDescription?: EmporixLocalizedString;
  slug?: EmporixLocalizedString;
  published?: boolean;
  visible?: boolean;
  position?: number;
  parentId?: string;
  supercategoriesIds?: string[];
  media?: EmporixMedia[];
  metadata?: EmporixMetadata;
  mixins?: EmporixMixins;
  customAttributes?: {
    [key: string]: any;
  };
}

export interface EmporixCategoryParent extends EmporixCategory {
  level?: number;
}

export const EmporixCategoryAssignmentType = 'PRODUCT';

export interface EmporixCategoryAssignment {
  id: string;
  categoryId: string;
  ref: {
    id: string;
    type: EmporixCategoryAssignmentType;
    localizedName?: EmporixLocalizedString;
  };
  metadata?: EmporixMetadata;
}

export interface EmporixCategoryAssignmentQuery {
  assignmentType?: EmporixCategoryAssignmentType;
  showUnpublished?: boolean;
  withSubcategories?: boolean;
  segmentsIds?: string;
  hideUnpublishedProducts?: boolean;
}
