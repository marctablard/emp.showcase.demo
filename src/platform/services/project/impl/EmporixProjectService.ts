import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixMediaApi } from '@/platform/integrations/emporix/media/EmporixMediaApi';
import type { EmporixProjectApi } from '@/platform/integrations/emporix/project/EmporixProjectApi';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Project, ProjectCreateDto, ProjectMediaAsset, ProjectUpdateDto } from '../../model/project/project';
import type { ProjectService as IProjectService } from '../ProjectService';

const MIXIN_KEY = 'projectinfo';

@injectable('ProjectService', 'Singleton')
export class EmporixProjectService implements IProjectService {
  constructor(
    @inject('EmporixProjectApi') private projectApi: EmporixProjectApi,
    @inject('CustomerService') private customerService: CustomerService,
    @inject('EmporixMediaApi') private mediaApi: EmporixMediaApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getProjects(): Promise<Project[]> {
    const customer = await this.customerService.getCustomer();
    if (!customer) return [];

    // Build a server-side filter query matching the devices pattern
    const q = customer.legalEntityId
      ? `mixins.${MIXIN_KEY}.company.id:${customer.legalEntityId}`
      : `mixins.${MIXIN_KEY}.customer.id:${customer.id}`;

    try {
      const entities = await this.projectApi.listProjects(q);
      return entities.map((e) => this.mapToProject(e));
    } catch (error) {
      this.logger.error({ error }, 'Failed to get projects');
      throw new Error(`Failed to get projects: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      const entity = await this.projectApi.getProject(projectId);
      if (!entity) return null;
      return this.mapToProject(entity);
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to get project');
      throw new Error(`Failed to get project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createProject(data: ProjectCreateDto): Promise<Project> {
    const customer = await this.customerService.getCustomer();
    if (!customer) throw new Error('Customer not found');

    try {
      const id = await this.projectApi.createProject({
        name: data.name,
        mixins: {
          [MIXIN_KEY]: {
            status: data.status,
            ...(data.startDate ? { datestart: data.startDate } : {}),
            ...(data.endDate ? { dateend: data.endDate } : {}),
            comment: data.comment ?? '',
            customer: {
              emporixReferenceType: 'CUSTOMER',
              id: customer.id,
            },
            ...(customer.legalEntityId
              ? {
                  company: {
                    emporixReferenceType: 'COMPANY',
                    id: customer.legalEntityId,
                  },
                }
              : {}),
          },
        },
        metadata: {
          mixins: {},
        },
      });

      const created = await this.projectApi.getProject(id);
      return this.mapToProject(created!);
    } catch (error) {
      this.logger.error({ error }, 'Failed to create project');
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateProject(projectId: string, data: ProjectUpdateDto): Promise<Project> {
    const existing = await this.projectApi.getProject(projectId);
    if (!existing) throw new Error(`Project ${projectId} not found`);

    const updated = {
      ...existing,
      ...(data.name ? { name: data.name } : {}),
      mixins: {
        ...existing.mixins,
        [MIXIN_KEY]: {
          ...existing.mixins?.[MIXIN_KEY],
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.startDate !== undefined ? { datestart: data.startDate } : {}),
          ...(data.endDate !== undefined ? { dateend: data.endDate } : {}),
          ...(data.comment !== undefined ? { comment: data.comment } : {}),
        },
      },
    };

    try {
      await this.projectApi.updateProject(projectId, updated);
      const refreshed = await this.projectApi.getProject(projectId);
      return this.mapToProject(refreshed!);
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to update project');
      throw new Error(`Failed to update project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.projectApi.deleteProject(projectId);
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to delete project');
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProjectMedia(projectId: string): Promise<ProjectMediaAsset[]> {
    const entity = await this.projectApi.getProject(projectId);
    if (!entity) return [];
    const mediaIds: string[] = entity.media ?? [];
    if (mediaIds.length === 0) return [];

    try {
      const assets = await Promise.all(mediaIds.map((id) => this.mediaApi.getAsset(id)));
      return assets.filter(Boolean).map((a) => ({
        id: a!.id,
        url: a!.url,
        fileName: a!.fileName ?? a!.id,
        contentType: a!.contentType ?? 'application/octet-stream',
        bytes: a!.bytes,
        createdAt: a!.createdAt,
      }));
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to get project media');
      throw new Error(`Failed to get project media: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async uploadProjectMedia(
    projectId: string,
    file: Blob,
    fileName: string,
    contentType: string,
  ): Promise<ProjectMediaAsset> {
    const entity = await this.projectApi.getProject(projectId);
    if (!entity) throw new Error(`Project ${projectId} not found`);

    try {
      const asset = await this.mediaApi.uploadAsset(file, fileName, contentType);

      const mediaIds = [...(entity.media ?? []), asset.id];
      await this.projectApi.updateProject(projectId, {
        ...entity,
        media: mediaIds,
      });

      return {
        id: asset.id,
        url: asset.url,
        fileName: fileName,
        contentType,
        createdAt: asset.createdAt,
      };
    } catch (error) {
      this.logger.error({ error, projectId }, 'Failed to upload project media');
      throw new Error(`Failed to upload project media: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProjectMedia(projectId: string, mediaId: string): Promise<void> {
    const entity = await this.projectApi.getProject(projectId);
    if (!entity) throw new Error(`Project ${projectId} not found`);

    try {
      await this.mediaApi.deleteAsset(mediaId);

      const mediaIds = (entity.media ?? []).filter((id) => id !== mediaId);
      await this.projectApi.updateProject(projectId, {
        ...entity,
        media: mediaIds,
      });
    } catch (error) {
      this.logger.error({ error, projectId, mediaId }, 'Failed to delete project media');
      throw new Error(`Failed to delete project media: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private mapToProject(entity: NonNullable<Awaited<ReturnType<EmporixProjectApi['getProject']>>>): Project {
    const info = entity.mixins?.[MIXIN_KEY] ?? {};
    return {
      id: entity.id!,
      name: entity.name ?? {},
      status: (info.status as Project['status']) ?? 'open',
      startDate: info.datestart,
      endDate: info.dateend,
      comment: info.comment,
      customerId: info.customer?.id ?? '',
      companyId: info.company?.id ?? '',
      mediaIds: entity.media ?? [],
      createdAt: entity.metadata?.createdAt,
      modifiedAt: entity.metadata?.modifiedAt,
    };
  }
}

export default EmporixProjectService;
