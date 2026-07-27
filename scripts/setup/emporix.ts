interface EmporixConfig {
  tenant: string;
  apiEndpoint: string;
  accessToken: string;
}

export class EmporixClient {
  private config: EmporixConfig;

  constructor(config: EmporixConfig) {
    this.config = config;
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Emporix-Tenant': this.config.tenant,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    return fetch(url, { ...options, headers });
  }

  // ---- Custom Entities ----

  async getCustomEntity(entityType: string): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/custom-entities/${entityType}`;
    return this.request(url);
  }

  async createCustomEntity(entity: { id: string; name: Record<string, string> }): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/custom-entities`;
    return this.request(url, {
      method: 'POST',
      headers: { 'Accept-Language': '*', 'Content-Language': '*' },
      body: JSON.stringify(entity),
    });
  }

  async updateCustomEntity(entityId: string, entity: { id: string; name: Record<string, string> }): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/custom-entities/${entityId}`;
    return this.request(url, {
      method: 'PUT',
      headers: { 'Accept-Language': '*', 'Content-Language': '*' },
      body: JSON.stringify(entity),
    });
  }

  // ---- Schemas ----

  async getSchema(schemaId: string): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/schemas/${schemaId}`;
    return this.request(url, {
      headers: { 'Accept-Language': '*' },
    });
  }

  async getAllSchemas(): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/schemas`;
    return this.request(url, {
      headers: { 'Accept-Language': '*' },
    });
  }

  async createSchema(schema: any): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/schemas`;
    return this.request(url, {
      method: 'POST',
      headers: { 'Accept-Language': '*', 'Content-Language': '*' },
      body: JSON.stringify(schema),
    });
  }

  async updateSchema(schemaId: string, schema: any): Promise<Response> {
    const url = `${this.config.apiEndpoint}/schema/${this.config.tenant}/schemas/${schemaId}`;
    return this.request(url, {
      method: 'PUT',
      headers: { 'Accept-Language': '*', 'Content-Language': '*' },
      body: JSON.stringify(schema),
    });
  }
}

export function createEmporixClient(config: EmporixConfig): EmporixClient {
  return new EmporixClient(config);
}
