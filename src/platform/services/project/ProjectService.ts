import type { Project, ProjectCreateDto, ProjectMediaAsset, ProjectUpdateDto } from '../model/project/project';

export interface ProjectService {
  /**
   * Get all projects accessible by the current logged-in customer (company-wide)
   */
  getProjects(): Promise<Project[]>;

  /**
   * Get a single project by ID
   */
  getProject(projectId: string): Promise<Project | null>;

  /**
   * Create a new project; customer and company are resolved automatically
   */
  createProject(data: ProjectCreateDto): Promise<Project>;

  /**
   * Update an existing project
   */
  updateProject(projectId: string, data: ProjectUpdateDto): Promise<Project>;

  /**
   * Delete a project by ID
   */
  deleteProject(projectId: string): Promise<void>;

  /**
   * List all media assets attached to a project
   */
  getProjectMedia(projectId: string): Promise<ProjectMediaAsset[]>;

  /**
   * Upload a new media asset and attach it to the project
   */
  uploadProjectMedia(projectId: string, file: Blob, fileName: string, contentType: string): Promise<ProjectMediaAsset>;

  /**
   * Remove a media asset from the project and delete the asset
   */
  deleteProjectMedia(projectId: string, mediaId: string): Promise<void>;
}
