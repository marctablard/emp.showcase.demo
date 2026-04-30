import type { LocalizedString } from '../common/index.d';

export type ProjectStatus = 'open' | 'hold' | 'closed';

export interface Project {
  id: string;
  name: LocalizedString;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  comment?: string;
  customerId: string;
  companyId: string;
  mediaIds: string[];
  createdAt?: string;
  modifiedAt?: string;
}

export interface ProjectCreateDto {
  name: LocalizedString;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  comment?: string;
}

export interface ProjectUpdateDto {
  name?: LocalizedString;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  comment?: string;
}

export interface ProjectMediaAsset {
  id: string;
  url: string;
  fileName: string;
  contentType: string;
  bytes?: number;
  createdAt?: string;
}
