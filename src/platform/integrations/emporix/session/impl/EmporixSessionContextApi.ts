import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type { EmporixContextAttribute, EmporixSessionContext } from '../../model/session-context';
import type { EmporixSessionContextApi as IEmporixSessionContextApi } from '../EmporixSessionContextApi';

const createSessionMetrics = (route: string) => createFetchMetricsParams('session', route);

interface OwnContextEntry {
  data: EmporixSessionContext | undefined;
  expiresAt: number;
}

interface SessionContextSharedCache {
  ownBySessionId: Map<string, OwnContextEntry>;
  ownInflight: Map<string, Promise<EmporixSessionContext | undefined>>;
}

const SESSION_CTX_CACHE_KEY = '__emporix_session_ctx_cache' as const;

function getSharedSessionCtxCache(): SessionContextSharedCache {
  const g = globalThis as unknown as Record<string, SessionContextSharedCache>;
  if (!g[SESSION_CTX_CACHE_KEY]) {
    g[SESSION_CTX_CACHE_KEY] = {
      ownBySessionId: new Map(),
      ownInflight: new Map(),
    };
  }
  return g[SESSION_CTX_CACHE_KEY];
}

@injectable('EmporixSessionContextApi', 'Singleton')
class EmporixSessionContextApi implements IEmporixSessionContextApi {
  private static readonly OWN_CONTEXT_TTL_MS = 5_000;
  private static readonly MAX_OWN_CONTEXT_CACHE_KEYS = 128;

  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
    @inject('EmporixTokenManager') private tokenManager: EmporixTokenManager,
    @inject('LoggerService') private logger: LoggerService,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  private get _ownBySessionId() {
    return getSharedSessionCtxCache().ownBySessionId;
  }
  private get _ownInflight() {
    return getSharedSessionCtxCache().ownInflight;
  }

  private clearAllOwnContextCache(): void {
    this._ownBySessionId.clear();
    this._ownInflight.clear();
  }

  private invalidateOwnContextCacheForSessionId(sessionId: string): void {
    this._ownBySessionId.delete(sessionId);
    this._ownInflight.delete(sessionId);
  }

  private pruneOwnContextCacheIfNeeded(): void {
    while (this._ownBySessionId.size >= EmporixSessionContextApi.MAX_OWN_CONTEXT_CACHE_KEYS) {
      const oldest = this._ownBySessionId.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.invalidateOwnContextCacheForSessionId(oldest);
    }
  }

  private async resolveOwnContextCacheKey(): Promise<string | null> {
    try {
      const { sessionId } = await this.tokenManager.getSessionToken(this.config.tenant, this.config.clientId);
      return sessionId;
    } catch {
      return null;
    }
  }

  async getSessionContext(sessionId: string): Promise<EmporixSessionContext | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}`,
      { method: 'GET' },
      'service',
      undefined,
      createSessionMetrics('/session-context/{tenant}/context/{id}'),
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
    const queryParams = upsert ? '?upsert=true' : '';
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}${queryParams}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionContext),
      },
      'service',
      { scopes: ['sessioncontext.context_manage'] },
      createSessionMetrics('/session-context/{tenant}/context/{id}'),
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to update session context: ${response.statusText} - ${message}`);
    }
    this.invalidateOwnContextCacheForSessionId(sessionId);
  }

  async addSessionContextAttribute(sessionId: string, attribute: EmporixContextAttribute): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}/attributes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attribute),
      },
      'service',
      { scopes: ['sessioncontext.context_manage'] },
      createSessionMetrics('/session-context/{tenant}/context/{id}/attributes'),
    );

    if (!response.ok) {
      throw new Error(`Failed to add session context attribute: ${response.statusText}`);
    }
    this.invalidateOwnContextCacheForSessionId(sessionId);
  }

  async removeSessionContextAttribute(sessionId: string, attributeName: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/context/${sessionId}/attributes/${attributeName}`,
      { method: 'DELETE' },
      'service',
      { scopes: ['sessioncontext.context_manage'] },
      createSessionMetrics('/session-context/{tenant}/context/{id}/attributes/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to remove session context attribute: ${response.statusText}`);
    }
    this.invalidateOwnContextCacheForSessionId(sessionId);
  }

  async getOwnSessionContext(): Promise<EmporixSessionContext | undefined> {
    const cacheKey = await this.resolveOwnContextCacheKey();
    if (!cacheKey) {
      return this._fetchOwnSessionContextWithoutCache();
    }

    const now = Date.now();
    const cached = this._ownBySessionId.get(cacheKey);
    if (cached && now < cached.expiresAt) {
      return cached.data;
    }

    const inflight = this._ownInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = this._fetchOwnSessionContextForKey(cacheKey, now);
    this._ownInflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this._ownInflight.delete(cacheKey);
    }
  }

  private async _fetchOwnSessionContextWithoutCache(): Promise<EmporixSessionContext | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context`,
      { method: 'GET' },
      'session',
      undefined,
      createSessionMetrics('/session-context/{tenant}/me/context'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      throw new Error(`Failed to get own session context: ${response.statusText}`);
    }

    return (await response.json()) as EmporixSessionContext;
  }

  private async _fetchOwnSessionContextForKey(
    cacheKey: string,
    now: number,
  ): Promise<EmporixSessionContext | undefined> {
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context`,
      { method: 'GET' },
      'session',
      undefined,
      createSessionMetrics('/session-context/{tenant}/me/context'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        this._ownBySessionId.delete(cacheKey);
        return undefined;
      }
      throw new Error(`Failed to get own session context: ${response.statusText}`);
    }

    const data = (await response.json()) as EmporixSessionContext;
    this.logger.debug(
      `getOwnSessionContext fetched session=${data.sessionId} site=${data.siteCode} currency=${data.currency} location=${data.targetLocation}`,
    );
    this.pruneOwnContextCacheIfNeeded();
    this._ownBySessionId.set(cacheKey, {
      data,
      expiresAt: now + EmporixSessionContextApi.OWN_CONTEXT_TTL_MS,
    });
    return data;
  }

  async updateOwnSessionContext(sessionContext: Partial<EmporixSessionContext>): Promise<void> {
    this.clearAllOwnContextCache();
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionContext),
      },
      'session',
      undefined,
      createSessionMetrics('/session-context/{tenant}/me/context'),
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to update own session context: ${response.statusText} - ${message}`);
    }
  }

  async addOwnSessionContextAttribute(attribute: EmporixContextAttribute): Promise<string> {
    this.clearAllOwnContextCache();
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context/attributes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attribute),
      },
      'session',
      undefined,
      createSessionMetrics('/session-context/{tenant}/me/context/attributes'),
    );

    if (!response.ok) {
      throw new Error(`Failed to add own session context attribute: ${response.statusText}`);
    }

    return await response.text();
  }

  async removeOwnSessionContextAttribute(attributeName: string): Promise<void> {
    this.clearAllOwnContextCache();
    const response = await this.apiClient.authenticatedFetch(
      `/session-context/${this.config.tenant}/me/context/attributes/${attributeName}`,
      { method: 'DELETE' },
      'session',
      undefined,
      createSessionMetrics('/session-context/{tenant}/me/context/attributes/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to remove own session context attribute: ${response.statusText}`);
    }
  }
}

export default EmporixSessionContextApi;
