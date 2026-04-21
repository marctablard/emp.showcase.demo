import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import type { EmporixConfig } from '../../config';
import type {
  EmporixCustomer,
  EmporixCustomerAddress,
  EmporixPasswordChangeRequest,
  EmporixSignupRequest,
} from '../../model/customer';
import type { EmporixSessionContext } from '../../model/session-context';
import type { EmporixCustomerApi as IEmporixCustomerApi } from '../EmporixCustomerApi';

const createCustomerMetrics = (route: string) => createFetchMetricsParams('customer', route);

@injectable('EmporixCustomerApi', 'Singleton')
class EmporixCustomerApi implements IEmporixCustomerApi {
  constructor(
    @inject('EmporixTokenManager') protected readonly tokenManager: EmporixTokenManager,
    @inject('EmporixApiInvoker') protected readonly apiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
  ) {}
  async getCustomerProfile(expand?: string): Promise<EmporixCustomer> {
    const url = `customer/${this.config.tenant}/me${expand ? `?expand=${expand}` : ''}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me'),
    );

    if (!response.ok) {
      throw new Error(`Failed to get customer profile: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCustomer;
  }

  async updateCustomerProfile(customerData: Partial<EmporixCustomer>): Promise<void> {
    const url = `customer/${this.config.tenant}/me`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(customerData),
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me'),
    );

    if (!response.ok) {
      throw new Error(`Failed to update customer profile: ${response.statusText}`);
    }
  }

  async deleteCustomerProfile(): Promise<void> {
    const url = `customer/${this.config.tenant}/me`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me'),
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete customer profile: ${response.statusText}`);
    }
  }

  async getCustomerAddresses(): Promise<EmporixCustomerAddress[]> {
    const url = `customer/${this.config.tenant}/me/addresses`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses'),
    );

    if (!response.ok) {
      throw new Error(`Failed to get customer addresses: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCustomerAddress[];
  }

  async addCustomerAddress(address: Partial<EmporixCustomerAddress>): Promise<{ id: string }> {
    const url = `customer/${this.config.tenant}/me/addresses`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(address),
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses'),
    );

    if (!response.ok) {
      throw new Error(`Failed to add customer address: ${response.statusText}`);
    }

    const result = await response.json();
    return { id: result.id };
  }

  async getCustomerAddressById(addressId: string): Promise<EmporixCustomerAddress> {
    const url = `customer/${this.config.tenant}/me/addresses/${addressId}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to get customer address: ${response.statusText}`);
    }

    return (await response.json()) as EmporixCustomerAddress;
  }

  async updateCustomerAddress(addressId: string, address: Partial<EmporixCustomerAddress>): Promise<void> {
    const url = `customer/${this.config.tenant}/me/addresses/${addressId}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(address),
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to update customer address: ${response.statusText}`);
    }
  }

  async deleteCustomerAddress(addressId: string): Promise<void> {
    const url = `customer/${this.config.tenant}/me/addresses/${addressId}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses/{id}'),
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete customer address: ${response.statusText}`);
    }
  }

  async addAddressTags(addressId: string, tags: string[]): Promise<void> {
    const url = `customer/${this.config.tenant}/me/addresses/${addressId}/tags?tags=${tags.join(',')}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses/{id}/tags'),
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to add address tags: ${response.statusText}`);
    }
  }

  async deleteAddressTags(addressId: string, tags: string[]): Promise<void> {
    const url = `customer/${this.config.tenant}/me/addresses/${addressId}/tags?tags=${tags.join(',')}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/me/addresses/{id}/tags'),
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete address tags: ${response.statusText}`);
    }
  }

  async logout(): Promise<void> {
    const token = await this.tokenManager.getCustomerToken(this.config.tenant, this.config.clientId);
    if (!token) {
      throw new Error('Failed to logout, missing customer token.');
    }
    const url = `customer/${this.config.tenant}/logout?accessToken=${token.accessToken}`;
    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'GET',
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/logout'),
    );

    if (!response.ok) {
      throw new Error(`Failed to logout: ${response.statusText}`);
    }
    await this.tokenManager.clearCustomerToken(this.config.tenant);
    await this.tokenManager.clearAnonymousToken(this.config.tenant);
  }

  async login(username: string, password: string): Promise<EmporixSessionContext> {
    const url = `/session-context/${this.config.tenant}/me/context`;
    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      'session',
      { credentials: { username, password } },
      createCustomerMetrics('/session-context/{tenant}/me/context'),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get customer token: ${response.statusText} - ${errorText}`);
    }

    return (await response.json()) as EmporixSessionContext;
  }

  async signup(signupRequest: EmporixSignupRequest): Promise<{ id: string }> {
    const url = `customer/${this.config.tenant}/signup`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(signupRequest),
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/signup'),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register customer: ${response.statusText} - ${errorText}`);
    }

    // After successful signup, login the user to get their profile
    return response.json();
  }

  async changePassword(passwordData: EmporixPasswordChangeRequest): Promise<void> {
    const url = `customer/${this.config.tenant}/password/change`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(passwordData),
      },
      'session',
      undefined,
      createCustomerMetrics('/customer/{tenant}/password/change'),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to change password: ${response.statusText} - ${errorText}`);
    }
  }

  async passwordReset(email: string): Promise<void> {
    const url = `customer/${this.config.tenant}/password/reset`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email,
        }),
      },
      'public',
      undefined,
      createCustomerMetrics('/customer/{tenant}/password/reset'),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to request Password Reset for E-Mail ${email}: ${response.statusText} - ${errorText}`);
    }

    return;
  }

  async passwordResetUpdate(token: string, password: string): Promise<void> {
    const url = `customer/${this.config.tenant}/password/reset/update`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          token: token,
          password: password,
        }),
      },
      'public',
      undefined,
      createCustomerMetrics('/customer/{tenant}/password/reset/update'),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to Update Password for Reset}: ${response.statusText} - ${errorText}`);
    }

    return;
  }
}

export default EmporixCustomerApi;
