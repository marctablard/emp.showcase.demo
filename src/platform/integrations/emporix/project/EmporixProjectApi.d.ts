export interface EmporixProjectEntity {
  id?: string;
  name?: Record<string, string>;
  type?: string;
  media?: string[];
  owner?: {
    type: string;
    userId: string;
    legalEntityId?: string;
  };
  mixins?: {
    projectinfo?: {
      status?: string;
      datestart?: string;
      dateend?: string;
      comment?: string;
      customer?: { emporixReferenceType: string; id: string };
      company?: { emporixReferenceType: string; id: string };
    };
    [key: string]: unknown;
  };
  metadata?: {
    version?: number;
    createdAt?: string;
    modifiedAt?: string;
    mixins?: Record<string, string>;
  };
}

export interface EmporixProjectCreatePayload {
  name: Record<string, string>;
  mixins: {
    projectinfo: {
      status: string;
      datestart?: string;
      dateend?: string;
      comment?: string;
      customer: { emporixReferenceType: string; id: string };
      company?: { emporixReferenceType: string; id: string };
    };
  };
  metadata: {
    mixins: Record<string, string>;
  };
}

export interface EmporixProjectApi {
  listProjects(q?: string): Promise<EmporixProjectEntity[]>;
  getProject(id: string): Promise<EmporixProjectEntity | null>;
  createProject(payload: EmporixProjectCreatePayload): Promise<string>;
  updateProject(id: string, entity: EmporixProjectEntity): Promise<void>;
  deleteProject(id: string): Promise<void>;
}
