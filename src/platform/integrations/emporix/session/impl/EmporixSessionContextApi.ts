import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import { EmporixContextAttribute, EmporixSessionContext } from '../../model/session-context';
import { EmporixSessionContextApi as IEmporixSessionContextApi } from '../EmporixSessionContextApi';

@injectable('EmporixSessionContextApi', 'Singleton')
class EmporixSessionContextApi implements IEmporixSessionContextApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getSessionContext(sessionId: string): Promise<EmporixSessionContext | undefined> {
    // DCPS-16635 clarify proper Token Handling for managed Sessions
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}`,
      { method: 'GET' },
      'service',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      throw new Error(`Failed to get session context: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateSessionContext(
    sessionId: string,
    sessionContext: Partial<EmporixSessionContext>,
    upsert: boolean = false,
  ): Promise<void> {
    // TODO clarify proper Token Handling for managed Sessions
    const queryParams = upsert ? '?upsert=true' : '';
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}${queryParams}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionContext),
      },
      'service',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to update session context: ${response.statusText} - ${message}`);
    }
  }

  async addSessionContextAttribute(sessionId: string, attribute: EmporixContextAttribute): Promise<void> {
    // TODO clarify proper Token Handling for managed Sessions
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}/attributes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attribute),
      },
      'service',
    );

    if (!response.ok) {
      throw new Error(`Failed to add session context attribute: ${response.statusText}`);
    }
  }

  async removeSessionContextAttribute(sessionId: string, attributeName: string): Promise<void> {
    // TODO clarify proper Token Handling for managed Sessions
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}/attributes/${attributeName}`,
      { method: 'DELETE' },
      'service',
    );

    if (!response.ok) {
      throw new Error(`Failed to remove session context attribute: ${response.statusText}`);
    }
  }

  async getOwnSessionContext(): Promise<EmporixSessionContext | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context`,
      { method: 'GET' },
      'session',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      throw new Error(`Failed to get own session context: ${response.statusText}`);
    }

    return await response.json();
  }

  async updateOwnSessionContext(sessionContext: Partial<EmporixSessionContext>): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionContext),
      },
      'session',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to update own session context: ${response.statusText} - ${message}`);
    }
  }

  async addOwnSessionContextAttribute(attribute: EmporixContextAttribute): Promise<string> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context/attributes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attribute),
      },
      'session',
    );

    if (!response.ok) {
      throw new Error(`Failed to add own session context attribute: ${response.statusText}`);
    }

    return await response.text();
  }

  async removeOwnSessionContextAttribute(attributeName: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context/attributes/${attributeName}`,
      { method: 'DELETE' },
      'session',
    );

    if (!response.ok) {
      throw new Error(`Failed to remove own session context attribute: ${response.statusText}`);
    }
  }
}

export default EmporixSessionContextApi;
