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
import type { MetricsService } from '@/platform/services/metrics/MetricsService';
import type { RequestContextService } from '@/platform/services/request-context/RequestContextService';
import type {
  AnonymousTokenSessionParams,
  EmporixAccessTokenResponse,
  EmporixAnonymousTokenResponse,
  EmporixCustomerTokenResponse,
} from '../../model/oauth';
import type { EmporixOAuthApi as IEmporixOAuthApi } from '../EmporixOAuthApi';

const METRICS_DEFAULT_SITE = 'unknown';

const METRIC_FETCH_TOTAL = 'emx_bff_oauth_fetch_total';
const METRIC_FETCH_ERRORS_TOTAL = 'emx_bff_oauth_fetch_errors_total';
const METRIC_FETCH_DURATION = 'emx_bff_oauth_fetch_duration_seconds';
const METRIC_LABEL_NAMES = ['site', 'method', 'status_code', 'source', 'route'] as const;
const HISTOGRAM_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@injectable('EmporixOAuthApi', 'Singleton')
class EmporixOAuthApiSSR implements IEmporixOAuthApi {
  protected readonly baseUrl: string = process.env.NEXT_PUBLIC_EMPORIX_BASE_URL || 'https://api.emporix.io';
  private metricsService: MetricsService;
  private requestContext: RequestContextService;

  constructor(
    @inject('MetricsService') metricsService: MetricsService,
    @inject('RequestContextService') requestContext: RequestContextService,
  ) {
    this.metricsService = metricsService;
    this.requestContext = requestContext;
  }

  private async fetchWithMetrics(url: string, options: RequestInit, routePattern: string): Promise<Response> {
    if (!this.metricsService.isEnabled()) {
      return this.fetch(url, options);
    }

    let site: string;
    try {
      site = await this.requestContext.getSite();
    } catch {
      site = METRICS_DEFAULT_SITE;
    }

    const method = (options.method || 'GET').toUpperCase();
    const startTime = performance.now();

    let response: Response;
    try {
      response = await this.fetch(url, options);
    } catch (error) {
      const labels = { site, method, status_code: '0', source: 'oauth', route: routePattern };
      this.metricsService
        .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total OAuth fetch calls', METRIC_LABEL_NAMES)
        .inc(labels);
      this.metricsService
        .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total OAuth fetch errors', METRIC_LABEL_NAMES)
        .inc(labels);
      const duration = (performance.now() - startTime) / 1000;
      this.metricsService
        .getOrCreateHistogram(
          METRIC_FETCH_DURATION,
          'OAuth fetch duration in seconds',
          METRIC_LABEL_NAMES,
          HISTOGRAM_BUCKETS,
        )
        .observe(labels, duration);
      throw error;
    }

    const labels = { site, method, status_code: String(response.status), source: 'oauth', route: routePattern };
    this.metricsService
      .getOrCreateCounter(METRIC_FETCH_TOTAL, 'Total OAuth fetch calls', METRIC_LABEL_NAMES)
      .inc(labels);
    if (!response.ok) {
      this.metricsService
        .getOrCreateCounter(METRIC_FETCH_ERRORS_TOTAL, 'Total OAuth fetch errors', METRIC_LABEL_NAMES)
        .inc(labels);
    }
    const duration = (performance.now() - startTime) / 1000;
    this.metricsService
      .getOrCreateHistogram(
        METRIC_FETCH_DURATION,
        'OAuth fetch duration in seconds',
        METRIC_LABEL_NAMES,
        HISTOGRAM_BUCKETS,
      )
      .observe(labels, duration);

    return response;
  }

  async getPublicToken(tenant: string, clientId: string): Promise<EmporixAnonymousTokenResponse> {
    const url = `/customerlogin/auth/anonymous/login?tenant=${tenant}&client_id=${clientId}`;

    const response = await this.fetchWithMetrics(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        // OAuth token responses must never be persisted in Next.js Data Cache —
        // that cache survives across Vercel deploys and would serve revoked
        // tokens after credential rotation. In-memory dedup/cache lives in
        // EmporixTokenManagerAbstract.
        cache: 'no-store',
      },
      '/customerlogin/auth/anonymous/login',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async getAnonymousToken(
    tenant: string,
    clientId: string,
    sessionParams?: AnonymousTokenSessionParams,
  ): Promise<EmporixAnonymousTokenResponse> {
    let url = `/customerlogin/auth/anonymous/login?tenant=${tenant}&client_id=${clientId}`;
    if (sessionParams) {
      if (sessionParams.siteCode) url += `&siteCode=${encodeURIComponent(sessionParams.siteCode)}`;
      if (sessionParams.currency) url += `&currency=${encodeURIComponent(sessionParams.currency)}`;
      if (sessionParams.language) url += `&language=${encodeURIComponent(sessionParams.language)}`;
      if (sessionParams.targetLocation) url += `&targetLocation=${encodeURIComponent(sessionParams.targetLocation)}`;
      if (sessionParams.region) url += `&region=${encodeURIComponent(sessionParams.region)}`;
    }

    const response = await this.fetchWithMetrics(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      '/customerlogin/auth/anonymous/login',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async refreshAnonymousToken(
    tenant: string,
    refreshToken: string,
    clientId: string,
  ): Promise<EmporixAnonymousTokenResponse> {
    const url = `/customerlogin/auth/anonymous/refresh?tenant=${tenant}&refresh_token=${refreshToken}&client_id=${clientId}`;

    const response = await this.fetchWithMetrics(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      '/customerlogin/auth/anonymous/refresh',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh anonymous token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixAnonymousTokenResponse;
  }

  async getCustomerToken(
    tenant: string,
    accessToken: string,
    username: string,
    password: string,
  ): Promise<EmporixCustomerTokenResponse> {
    const url = `/customer/${tenant}/login`;
    const response = await this.fetchWithMetrics(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: username, password: password }),
      },
      '/customer/{tenant}/login',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  async refreshCustomerToken(
    tenant: string,
    accessToken: string,
    refreshToken: string,
    legalEntityId?: string,
  ): Promise<EmporixCustomerTokenResponse> {
    let url = `/customer/${tenant}/refreshauthtoken?refreshToken=${refreshToken}`;
    if (legalEntityId) {
      url += `&legalEntityId=${encodeURIComponent(legalEntityId)}`;
    }

    const response = await this.fetchWithMetrics(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
      '/customer/{tenant}/refreshauthtoken',
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to refresh customer token: ${response.statusText} - ${message}`);
    }

    return (await response.json()) as EmporixCustomerTokenResponse;
  }

  async getServiceAccessToken(
    tenant: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
  ): Promise<EmporixAccessTokenResponse> {
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    if (scopes) {
      formData.append('scope', `tenant=${tenant}` + (scopes ? ` ${scopes.join(' ')}` : ''));
    }
    const response = await this.fetchWithMetrics(
      '/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formData,
        // OAuth token responses must never be persisted in Next.js Data Cache —
        // that cache survives across Vercel deploys and would serve revoked
        // tokens after credential rotation. In-memory dedup/cache lives in
        // EmporixTokenManagerAbstract.
        cache: 'no-store',
      },
      '/oauth/token',
    );

    if (!response.ok) {
      throw new Error(`Failed to get service access token: ${response.statusText}`);
    }
    return (await response.json()) as EmporixAccessTokenResponse;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    url = `${this.baseUrl}${url.startsWith('/') ? url : '/' + url}`;
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
}

export default EmporixOAuthApiSSR;
