import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { SetupOperation } from '@/platform/services/model/setup/setup';
import type { EmporixSetupService as IEmporixSetupService } from '../EmporixSetupService';

/**
 * Implementation of the EmporixSetupService for executing Emporix-specific setup operations
 */
@injectable('EmporixSetupService', 'Singleton')
export class EmporixSetupService implements IEmporixSetupService {
  constructor(
    @inject('EmporixApiInvoker') private apiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  /**
   * Execute a setup operation against the Emporix API
   * @param operation The operation to execute
   * @returns The result of the operation
   */
  async executeOperation(operation: SetupOperation): Promise<any> {
    // Extract the method and path from the endpoint
    const [method, path] = this.parseEndpoint(operation.endpoint);

    // Determine which token to use
    const token = operation.token || 'service';

    // Set up request options
    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Merge any custom headers from the operation
        ...operation.headers,
      },
    };

    // Add payload for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && operation.payload) {
      options.body = JSON.stringify(operation.payload);
    }

    // Execute the API call
    const response = await this.apiInvoker.authenticatedFetch(path, options, token as any);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Return the response as JSON if possible
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Parse the endpoint string into method and path
   */
  private parseEndpoint(endpoint: string): [string, string] {
    const match = endpoint.match(/^([A-Z]+):(.+)$/);
    if (!match) {
      throw new Error(`Invalid endpoint format: ${endpoint}. Expected format: METHOD:/path/to/resource`);
    }

    const [, method, path] = match;

    // Replace [tenant] placeholder with the actual tenant
    const tenant = this.config.tenant || process.env.NEXT_EMPORIX_TENANT || '';
    const resolvedPath = path.replace(/\[tenant\]/g, tenant);

    return [method, resolvedPath];
  }
}

export default EmporixSetupService;
