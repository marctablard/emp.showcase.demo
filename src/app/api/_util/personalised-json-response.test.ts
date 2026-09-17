import { isPersonalised, jsonResponse } from './personalised-json-response';

describe('personalised-json-response', () => {
  it('treats assigned and all as personalised', () => {
    expect(isPersonalised({ mode: 'assigned' })).toBe(true);
    expect(isPersonalised({ mode: 'all' })).toBe(true);
    expect(isPersonalised({ mode: 'anonymous' })).toBe(false);
    expect(isPersonalised({ mode: 'unsegmented' })).toBe(false);
    expect(isPersonalised(undefined)).toBe(false);
  });

  it('sets private no-store only when personalised', () => {
    expect(jsonResponse({ ok: true }, true).headers.get('cache-control')).toBe('private, no-store');
    expect(jsonResponse({ ok: true }, false).headers.get('cache-control')).toBeNull();
    expect(jsonResponse({ error: 'x' }, true, 500).status).toBe(500);
  });
});
