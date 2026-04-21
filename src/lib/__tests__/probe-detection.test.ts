import { isLikelyProbe, isProbeUserAgent } from '@/site/probe-detection';

function req(init: {
  method?: string;
  headers?: Record<string, string | undefined>;
}): Parameters<typeof isLikelyProbe>[0] {
  const h = new Map<string, string>();
  for (const [k, v] of Object.entries(init.headers ?? {})) {
    if (v !== undefined) {
      h.set(k.toLowerCase(), v);
    }
  }
  return {
    method: init.method ?? 'GET',
    headers: { get: (name: string) => h.get(name.toLowerCase()) ?? null },
  };
}

describe('probe-detection', () => {
  it('treats kube-probe user agents as probes', () => {
    expect(isProbeUserAgent('kube-probe/1.29')).toBe(true);
  });

  it('does not treat browser-like navigations as probes', () => {
    expect(
      isLikelyProbe(
        req({
          headers: {
            'user-agent': '',
            accept: 'text/html,application/xhtml+xml',
            'accept-language': '',
            referer: '',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-dest': 'document',
          },
        }),
      ),
    ).toBe(false);
  });

  it('does not treat Playwright-style document GET as a probe when Accept includes text/html', () => {
    expect(
      isLikelyProbe(
        req({
          headers: {
            'user-agent': '',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
          },
        }),
      ),
    ).toBe(false);
  });

  it('still treats generic minimal GET as a likely probe', () => {
    expect(
      isLikelyProbe(
        req({
          headers: {
            'user-agent': '',
            accept: '*/*',
            'accept-language': '',
            'sec-fetch-dest': '',
            'sec-fetch-mode': '',
            referer: '',
          },
        }),
      ),
    ).toBe(true);
  });

  it('treats HEAD as probe', () => {
    expect(isLikelyProbe(req({ method: 'HEAD', headers: { 'user-agent': 'Mozilla/5.0' } }))).toBe(true);
  });
});
