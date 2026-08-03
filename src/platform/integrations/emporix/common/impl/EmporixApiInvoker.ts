import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import {
  type DebugContext,
  buildAndLogCurl,
  getDebugLogger,
  logRequestPayload,
  logResponse,
  shouldBypassExternalCacheForDebug,
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
class EmporixApiInvoker {
  protected config: EmporixConfig;
  protected tokenManager: EmporixTokenManager;
  private readonly metricsService: MetricsService;
  private readonly requestContext: RequestContextService;

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
    const { token, headers } = await this.resolveAuthTokenAndHeaders(options.headers, tokenType, authOptions);
    this.applyCacheOptions(url, options, cacheSeconds);

    const requestUrl = this.normalizeUrl(url);
    const requestHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
    const metricsContext = await this.createMetricsContext(metrics);

    let response = await this.fetchWithMetrics(
      requestUrl,
      { ...options, headers: requestHeaders },
      tokenType,
      metrics,
      metricsContext,
    );

    if (response.status === 401 && tokenType === 'public') {
      response = await this.retryPublicFetchWithMetrics(requestUrl, options, tokenType, metrics, metricsContext);
    }

    return response;
  }

  private normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) {
      return {};
    }
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    return { ...headers };
  }

  private async resolveAuthTokenAndHeaders(
    originalHeaders: HeadersInit | undefined,
    tokenType: 'public' | 'session' | 'customer-saas' | 'ai' | 'service',
    authOptions?: {
      credentials?: { username: string; password: string };
      scopes?: string[];
    },
  ): Promise<{ token: string; headers: Record<string, string> }> {
    let token: string;
    let headers: Record<string, string> = this.normalizeHeaders(originalHeaders);

    switch (tokenType) {
      case 'public': {
        const publicToken = await this.tokenManager.getPublicToken(this.config.tenant, this.config.clientId);
        token = publicToken.accessToken;
        headers = {
          ...headers,
          ...this.addPublicHeaders(publicToken),
        };
        break;
      }
      case 'customer-saas':
      case 'session':
      case 'ai': {
        const sessionResolution = await this.resolveSessionTokenAndHeaders(headers, tokenType, authOptions);
        token = sessionResolution.token;
        headers = sessionResolution.headers;
        break;
      }
      case 'service': {
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
      }
      default:
        throw new Error(`Unknown token type: ${tokenType}`);
    }

    return { token, headers };
  }

  private async resolveSessionTokenAndHeaders(
    originalHeaders: HeadersInit,
    tokenType: 'session' | 'customer-saas' | 'ai',
    authOptions?: {
      credentials?: { username: string; password: string };
      scopes?: string[];
    },
  ): Promise<{ token: string; headers: Record<string, string> }> {
    const sessionToken = await this.tokenManager.getSessionToken(
      this.config.tenant,
      this.config.clientId,
      authOptions?.credentials,
    );

    let headers: Record<string, string> = this.normalizeHeaders(originalHeaders);

    if (tokenType === 'customer-saas' || tokenType === 'ai') {
      if (!sessionToken.saasToken) {
        throw new Error('No SaaS token available');
      }

      headers = {
        ...headers,
        ...this.addCustomerHeaders(sessionToken),
      };

      if (tokenType === 'ai' && !headers['session-id']) {
        headers = {
          ...headers,
          'session-id': `${sessionToken.sessionId}`,
        };
      }
    } else {
      headers = {
        ...headers,
        ...this.addSessionHeaders(sessionToken),
      };
    }

    return {
      token: sessionToken.accessToken,
      headers,
    };
  }

  private applyCacheOptions(url: string, options: RequestInit, cacheSeconds?: number): void {
    const method = (options.method || 'GET').toUpperCase();
    const isWriteMethod = method !== 'GET' && method !== 'HEAD';
    const cacheBypassForDebug = shouldBypassExternalCacheForDebug(`${this.config.baseUrl}/${url}`, {
      callType: 'external',
      source: this.requestContext.getCallSource(),
    });

    if (isWriteMethod || cacheBypassForDebug) {
      options['cache'] = 'no-store';
      delete (options as Record<string, unknown>)['next'];
      return;
    }

    if (!options['cache'] && !options['next'] && cacheSeconds !== undefined) {
      options['cache'] = 'force-cache';
      options['next'] = { revalidate: cacheSeconds };
    }
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith('/')) {
      return url.substring(1);
    }
    return url;
  }

  private async createMetricsContext(metrics?: FetchMetrics): Promise<{
    enabled: boolean;
    site?: string;
    startTime?: number;
  }> {
    const enabled = this.metricsService.isEnabled();
    if (!enabled || !metrics) {
      return { enabled, site: undefined, startTime: undefined };
    }

    let site: string | undefined;
    try {
      site = await this.requestContext.getSite();
    } catch {
      site = METRICS_DEFAULT_SITE;
    }

    return { enabled, site, startTime: performance.now() };
  }

  private createMetricsLabels(
    url: string,
    options: RequestInit,
    tokenType: TokenType,
    metrics: FetchMetrics,
    site: string | undefined,
    statusCode: string,
  ): {
    site: string;
    method: string;
    status_code: string;
    source: string;
    token_type: TokenType;
    route: string;
  } {
    const method = (options.method || 'GET').toUpperCase();
    // NOTE: this `source` is the API domain (e.g. `cart`, `product`), unrelated to the
    // DebugCallSource used for debug logging — see `requestContext.getCallSource()`.
    const source = metrics.source || getFirstUrlSegment(url, 'unknown');
    const route = metrics.routePattern || url;

    return {
      site: site || METRICS_DEFAULT_SITE,
      method,
      status_code: statusCode,
      source,
      token_type: tokenType,
      route,
    };
  }

  private observeFetchDuration(
    labels: {
      site: string;
      method: string;
      status_code: string;
      source: string;
      token_type: TokenType;
      route: string;
    },
    startTime: number,
  ): void {
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

  private recordFetchErrorMetrics(
    url: string,
    options: RequestInit,
    tokenType: TokenType,
    metrics: FetchMetrics,
    site: string | undefined,
    startTime: number,
  ): void {
    const labels = this.createMetricsLabels(url, options, tokenType, metrics, site, '0');
    this.metricsService
      .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total upstream API fetch calls', METRIC_LABEL_NAMES)
      .inc(labels);
    this.metricsService
      .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total upstream API fetch errors', METRIC_LABEL_NAMES)
      .inc(labels);
    this.observeFetchDuration(labels, startTime);
  }

  private recordFetchResponseMetrics(
    response: Response,
    url: string,
    options: RequestInit,
    tokenType: TokenType,
    metrics: FetchMetrics,
    site: string | undefined,
    startTime: number,
  ): void {
    const labels = this.createMetricsLabels(url, options, tokenType, metrics, site, String(response.status));
    this.metricsService
      .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total upstream API fetch calls', METRIC_LABEL_NAMES)
      .inc(labels);
    if (!response.ok) {
      this.metricsService
        .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total upstream API fetch errors', METRIC_LABEL_NAMES)
        .inc(labels);
    }
    this.observeFetchDuration(labels, startTime);
  }

  private async fetchWithMetrics(
    url: string,
    requestInit: RequestInit,
    tokenType: TokenType,
    metrics: FetchMetrics | undefined,
    metricsContext: { enabled: boolean; site?: string; startTime?: number },
  ): Promise<Response> {
    try {
      const response = await this.fetch(url, requestInit);
      if (metricsContext.enabled && metrics && metricsContext.startTime !== undefined) {
        this.recordFetchResponseMetrics(
          response,
          url,
          requestInit,
          tokenType,
          metrics,
          metricsContext.site,
          metricsContext.startTime,
        );
      }
      return response;
    } catch (error) {
      if (metricsContext.enabled && metrics && metricsContext.startTime !== undefined) {
        this.recordFetchErrorMetrics(
          url,
          requestInit,
          tokenType,
          metrics,
          metricsContext.site,
          metricsContext.startTime,
        );
      }
      throw error;
    }
  }

  /**
   * A public token can be rejected while still cached (rotated or revoked upstream).
   * Drop the cache entry, mint a fresh token and replay the request once.
   */
  private async retryPublicFetchWithMetrics(
    url: string,
    options: RequestInit,
    tokenType: TokenType,
    metrics: FetchMetrics | undefined,
    metricsContext: { enabled: boolean; site?: string; startTime?: number },
  ): Promise<Response> {
    this.tokenManager.clearPublicTokenCache(this.config.tenant, this.config.clientId);
    const freshToken = await this.tokenManager.getPublicToken(this.config.tenant, this.config.clientId);
    const retryHeaders = {
      ...this.normalizeHeaders(options.headers),
      ...this.addPublicHeaders(freshToken),
      Authorization: `Bearer ${freshToken.accessToken}`,
    };
    const retryRequest = { ...options, headers: retryHeaders };
    const retryStartTime = metricsContext.enabled && metrics ? performance.now() : undefined;
    const response = await this.fetch(url, retryRequest);

    if (metricsContext.enabled && metrics && retryStartTime !== undefined) {
      this.recordFetchResponseMetrics(
        response,
        url,
        retryRequest,
        tokenType,
        metrics,
        metricsContext.site,
        retryStartTime,
      );
    }

    return response;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    url = `${this.config.baseUrl}/${url}`;
    // `source` comes from the env-specific RequestContextService: the server container
    // reports 'client' (API routes are browser-triggered), the SSR container 'ssr'.
    const ctx: DebugContext = { callType: 'external', source: this.requestContext.getCallSource() };
    const prefix = buildAndLogCurl(url, options, ctx);
    logRequestPayload(url, options, prefix, ctx);
    const responsePromise = fetch(url, options);
    // Both outcomes are handled on a single derived promise. Attaching `.catch()` and
    // `.then()` as two separate branches leaves the `.then()` branch without a rejection
    // handler, so a network-level failure raised an unhandled rejection on top of the
    // error the caller already receives via the returned promise.
    responsePromise.then(
      (response) => logResponse(response, url, options, prefix, ctx),
      (err) =>
        getDebugLogger().error(
          { url, error: err instanceof Error ? err.message : String(err) },
          `${prefix} [FETCH ERROR]`,
        ),
    );
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
export default EmporixApiInvoker;
