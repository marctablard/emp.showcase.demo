import { Container } from 'inversify';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixTokenManager } from '../common/EmporixTokenManager';
import type EmporixApiInvoker from '../common/impl/EmporixApiInvoker';
import { EmporixConfig } from '../config';
import EmporixSessionContextApi from './impl/EmporixSessionContextApi';

class TestEmporixConfig implements EmporixConfig {
  baseUrl = 'https://api.emporix.io';
  tenant = 'showcasetest';
  clientId = 'test-client';
  clientSecret = '';
  serverClientId = '';
  serverClientSecret = '';
}

describe('EmporixSessionContextApi own-context cache (keyed)', () => {
  let container: Container;
  let api: EmporixSessionContextApi;
  let keyedInvoker: { authenticatedFetch: jest.Mock };
  let getSessionTokenMock: jest.Mock;

  beforeEach(() => {
    delete (globalThis as Record<string, unknown>)['__emporix_session_ctx_cache'];
    keyedInvoker = { authenticatedFetch: jest.fn() };
    getSessionTokenMock = jest.fn();

    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixTokenManager>('EmporixTokenManager').toConstantValue({
      getSessionToken: getSessionTokenMock,
    } as unknown as EmporixTokenManager);
    container
      .bind<EmporixApiInvoker>('EmporixApiInvoker')
      .toConstantValue(keyedInvoker as unknown as EmporixApiInvoker);
    container.bind<LoggerService>('LoggerService').toConstantValue({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as LoggerService);
    container.bind<EmporixSessionContextApi>('EmporixSessionContextApi').to(EmporixSessionContextApi);
    api = container.get<EmporixSessionContextApi>('EmporixSessionContextApi');
  });

  it('dedupes /me/context per sessionId within TTL', async () => {
    getSessionTokenMock.mockResolvedValue({ accessToken: 'a', sessionId: 'sid-1' });
    keyedInvoker.authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ sessionId: 'sid-1', siteCode: 'main' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await api.getOwnSessionContext();
    await api.getOwnSessionContext();

    expect(keyedInvoker.authenticatedFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches when sessionId from token changes', async () => {
    getSessionTokenMock
      .mockResolvedValueOnce({ accessToken: 'a', sessionId: 'sid-1' })
      .mockResolvedValue({ accessToken: 'b', sessionId: 'sid-2' });
    keyedInvoker.authenticatedFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: 'sid-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: 'sid-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await api.getOwnSessionContext();
    await api.getOwnSessionContext();

    expect(keyedInvoker.authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it('clears cached entry for sessionId after successful updateSessionContext', async () => {
    getSessionTokenMock.mockResolvedValue({ accessToken: 'a', sessionId: 'sid-svc' });
    keyedInvoker.authenticatedFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: 'sid-svc', siteCode: 'x' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessionId: 'sid-svc', siteCode: 'y' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await api.getOwnSessionContext();
    await api.updateSessionContext('sid-svc', { siteCode: 'y' }, false);
    await api.getOwnSessionContext();

    expect(keyedInvoker.authenticatedFetch).toHaveBeenCalledTimes(3);
  });
});
