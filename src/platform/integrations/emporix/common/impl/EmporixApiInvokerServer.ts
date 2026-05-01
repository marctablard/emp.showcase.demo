import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import {
  type DebugContext,
  buildAndLogCurl,
  getDebugLogger,
  logRequestPayload,
  logResponse,
} from '@/platform/core/utils/debug-utils';
import type { FetchMetrics } from '@/platform/integrations/emporix/model/metrics';
import type { MetricsService } from '@/platform/services/metrics/MetricsService';
import type { TokenType } from '@/platform/services/model/auth';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import { getFirstUrlSegment } from '@/utils/getFirstUrlSegment';
import type { EmporixConfig } from '../../config';
import type { EmporixTokenManager } from '../EmporixTokenManager';

const METRICS_DEFAULT_SITE = 'unknown';

const METRIC_FETCH_TOTAL = 'emx_bff_api_fetch_total';
const METRIC_FETCH_ERRORS_TOTAL = 'emx_bff_api_fetch_errors_total';
const METRIC_FETCH_DURATION = 'emx_bff_api_fetch_duration_seconds';
const METRIC_LABEL_NAMES = ['site', 'method', 'status_code', 'source', 'token_type', 'route'] as const;
const HISTOGRAM_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@injectable('EmporixApiInvoker', 'Singleton')
class EmporixApiInvokerServer {
  protected config: EmporixConfig;
  protected tokenManager: EmporixTokenManager;
  private metricsService: MetricsService;
  private requestContext: RequestContextService;

  constructor(
    @inject('EmporixConfig') config: EmporixConfig,
    @inject('EmporixTokenManager') tokenManager: EmporixTokenManager,
    @inject('MetricsService') metricsService: MetricsService,
    @inject('RequestContextService') requestContext: RequestContextService,
  ) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.metricsService = metricsService;
    this.requestContext = requestContext;
  }

  async getAnonymousToken(): Promise<{ accessToken: string; sessionId: string }> {
    return this.tokenManager.getAnonymousToken(this.config.tenant, this.config.clientId);
  }

  async getServiceAccessToken(scopes?: string[]): Promise<string> {
    if (!this.config.serverClientId || !this.config.serverClientSecret) {
      throw new Error('Service Credentials not available');
    }
    return this.tokenManager.getServiceAccessToken(
      this.config.tenant,
      this.config.serverClientId,
      this.config.serverClientSecret,
      scopes,
    );
  }

  /**
   * Create an authenticated fetch request.
   *
   * Caching is opt-in: callers enable it for an endpoint by passing `cacheSeconds`
   * (applies to GET/HEAD only, and only when the caller has not set `cache`/`next`
   * on `options`). Write methods are always forced to `cache: 'no-store'`.
   */
  async authenticatedFetch(
    url: string,
    options: RequestInit = {},
    tokenType: TokenType = 'public',
    authOptions?: {
      credentials?: { username: string; password: string };
      scopes?: string[];
    },
    metrics?: FetchMetrics,
    cacheSeconds?: number,
  ): Promise<Response> {
    let token: string;

    let headers = {
      ...options.headers,
    };

    switch (tokenType) {
      case 'public':
        const publicToken = await this.tokenManager.getPublicToken(this.config.tenant, this.config.clientId);
        token = publicToken.accessToken;
        headers = {
          ...headers,
          ...this.addPublicHeaders(publicToken),
        };
        break;
      case 'customer-saas':
      case 'session':
      case 'ai':
        const sessionToken = await this.tokenManager.getSessionToken(
          this.config.tenant,
          this.config.clientId,
          authOptions?.credentials,
        );
        token = sessionToken.accessToken;
        if (tokenType === 'customer-saas' || tokenType === 'ai') {
          if (sessionToken.saasToken) {
            headers = {
              ...headers,
              ...this.addCustomerHeaders(sessionToken),
            };
          } else {
            throw new Error('No SaaS token available');
          }
          if (tokenType === 'ai') {
            const headersObj = headers as Record<string, string>;
            if (!headersObj['session-id']) {
              headers = {
                ...headers,
                'session-id': `${sessionToken.sessionId}`,
              };
            }
          }
        } else {
          headers = {
            ...headers,
            ...this.addSessionHeaders(sessionToken),
          };
        }
        break;
      case 'service':
        if (!this.config.serverClientId || !this.config.serverClientSecret) {
          throw new Error('Service Credentials not available');
        }
        token = await this.tokenManager.getServiceAccessToken(
          this.config.tenant,
          this.config.serverClientId,
          this.config.serverClientSecret,
          authOptions?.scopes,
        );
        break;
      default:
        throw new Error(`Unknown token type: ${tokenType}`);
    }

    {
      const method = (options.method || 'GET').toUpperCase();
      const isWriteMethod = method !== 'GET' && method !== 'HEAD';

      if (isWriteMethod) {
        options['cache'] = 'no-store';
        delete (options as Record<string, unknown>)['next'];
      } else if (!options['cache'] && !options['next'] && cacheSeconds !== undefined) {
        options['cache'] = 'force-cache';
        options['next'] = { revalidate: cacheSeconds };
      }
    }

    headers = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    if (url.startsWith('/')) {
      url = url.substring(1);
    }

    const metricsEnabled = this.metricsService.isEnabled();
    let site: string | undefined;
    let startTime: number | undefined;

    if (metricsEnabled && metrics) {
      try {
        site = await this.requestContext.getSite();
      } catch {
        site = METRICS_DEFAULT_SITE;
      }
      startTime = performance.now();
    }

    let response: Response;
    try {
      response = await this.fetch(url, { ...options, headers });
    } catch (error) {
      if (metricsEnabled && metrics && startTime !== undefined) {
        const method = (options.method || 'GET').toUpperCase();
        const source = metrics.source || getFirstUrlSegment(url, 'unknown');
        const route = metrics.routePattern || url;
        const labels = {
          site: site || METRICS_DEFAULT_SITE,
          method,
          status_code: '0',
          source,
          token_type: tokenType,
          route,
        };
        this.metricsService
          .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total upstream API fetch calls', METRIC_LABEL_NAMES)
          .inc(labels);
        this.metricsService
          .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total upstream API fetch errors', METRIC_LABEL_NAMES)
          .inc(labels);
        const duration = (performance.now() - startTime) / 1000;
        this.metricsService
          .getOrCreateHistogram(
            METRIC_FETCH_DURATION,
            'Upstream API fetch duration in seconds',
            METRIC_LABEL_NAMES,
            HISTOGRAM_BUCKETS,
          )
          .observe(labels, duration);
      }
      throw error;
    }

    if (metricsEnabled && metrics && startTime !== undefined) {
      const method = (options.method || 'GET').toUpperCase();
      const source = metrics.source || getFirstUrlSegment(url, 'unknown');
      const route = metrics.routePattern || url;
      const labels = {
        site: site || METRICS_DEFAULT_SITE,
        method,
        status_code: String(response.status),
        source,
        token_type: tokenType,
        route,
      };
      this.metricsService
        .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total upstream API fetch calls', METRIC_LABEL_NAMES)
        .inc(labels);
      if (!response.ok) {
        this.metricsService
          .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total upstream API fetch errors', METRIC_LABEL_NAMES)
          .inc(labels);
      }
      const duration = (performance.now() - startTime) / 1000;
      this.metricsService
        .getOrCreateHistogram(
          METRIC_FETCH_DURATION,
          'Upstream API fetch duration in seconds',
          METRIC_LABEL_NAMES,
          HISTOGRAM_BUCKETS,
        )
        .observe(labels, duration);
    }

    if (response.status === 401 && tokenType === 'public') {
      this.tokenManager.clearPublicTokenCache(this.config.tenant, this.config.clientId);
      const freshToken = await this.tokenManager.getPublicToken(this.config.tenant, this.config.clientId);
      const retryHeaders = {
        ...options.headers,
        ...this.addPublicHeaders(freshToken),
        Authorization: `Bearer ${freshToken.accessToken}`,
      };
      const retryStartTime = metricsEnabled && metrics ? performance.now() : undefined;
      response = await this.fetch(url, { ...options, headers: retryHeaders });

      if (metricsEnabled && metrics && retryStartTime !== undefined) {
        const method = (options.method || 'GET').toUpperCase();
        const source = metrics.source || getFirstUrlSegment(url, 'unknown');
        const route = metrics.routePattern || url;
        const retryLabels = {
          site: site || METRICS_DEFAULT_SITE,
          method,
          status_code: String(response.status),
          source,
          token_type: tokenType,
          route,
        };
        this.metricsService
          .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total upstream API fetch calls', METRIC_LABEL_NAMES)
          .inc(retryLabels);
        if (!response.ok) {
          this.metricsService
            .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total upstream API fetch errors', METRIC_LABEL_NAMES)
            .inc(retryLabels);
        }
        const duration = (performance.now() - retryStartTime) / 1000;
        this.metricsService
          .getOrCreateHistogram(
            METRIC_FETCH_DURATION,
            'Upstream API fetch duration in seconds',
            METRIC_LABEL_NAMES,
            HISTOGRAM_BUCKETS,
          )
          .observe(retryLabels, duration);
      }
    }

    return response;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    url = `${this.config.baseUrl}/${url}`;
    const ctx: DebugContext = { callType: 'external' };
    const prefix = buildAndLogCurl(url, options, ctx);
    logRequestPayload(url, options, prefix, ctx);
    const responsePromise = fetch(url, options);
    responsePromise.catch((err) =>
      getDebugLogger().error(
        { url, error: err instanceof Error ? err.message : String(err) },
        `${prefix} [FETCH ERROR]`,
      ),
    );
    responsePromise.then((response) => logResponse(response, url, options, prefix, ctx));
    return responsePromise;
  }

  async clearTokens(): Promise<void> {
    this.tokenManager.clearTokens(this.config.tenant);
  }

  protected addCustomerHeaders(sessionToken: {
    accessToken: string;
    saasToken?: string;
    sessionId: string;
  }): Record<string, string> {
    if (sessionToken.saasToken) {
      return { 'saas-token': `${sessionToken.saasToken}` };
    }
    return {};
  }

  protected addSessionHeaders(sessionToken: {
    accessToken: string;
    saasToken?: string;
    sessionId: string;
  }): Record<string, string> {
    if (sessionToken.sessionId) {
      return { 'session-id': `${sessionToken.sessionId}` };
    }
    return {};
  }

  protected addPublicHeaders(_publicToken: { accessToken: string }): Record<string, string> {
    return {};
  }
}
export default EmporixApiInvokerServer;
