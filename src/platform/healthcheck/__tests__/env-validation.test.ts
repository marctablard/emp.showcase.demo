import { OPTIONAL_ENV_VARS, REQUIRED_ENV_VARS, validateEnvVars } from '../env-validation';

describe('validateEnvVars', () => {
  const allRequiredKeys = REQUIRED_ENV_VARS.map((v) => v.key);
  const allOptionalKeys = OPTIONAL_ENV_VARS.map((v) => v.key);
  const allKeys = [...allRequiredKeys, ...allOptionalKeys];

  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    // Set all vars to valid values so tests start from a clean slate
    for (const key of allKeys) {
      process.env[key] = 'test-value';
    }
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('should return hasErrors: false when all mandatory vars are present', () => {
    const result = validateEnvVars();
    expect(result.hasErrors).toBe(false);
    expect(result.tier).toBe('env');
  });

  it('should return hasErrors: true when one mandatory var is missing', () => {
    delete process.env.NEXT_PUBLIC_EMPORIX_TENANT;

    const result = validateEnvVars();

    expect(result.hasErrors).toBe(true);
    const failedItem = result.items.find((i) => i.name === 'NEXT_PUBLIC_EMPORIX_TENANT');
    expect(failedItem).toBeDefined();
    expect(failedItem!.passed).toBe(false);
    expect(failedItem!.severity).toBe('error');
    expect(failedItem!.message).toContain('missing');
  });

  it('should report all missing mandatory vars, not just the first', () => {
    delete process.env.NEXT_PUBLIC_EMPORIX_BASE_URL;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXT_PUBLIC_DEFAULT_CURRENCY;

    const result = validateEnvVars();

    expect(result.hasErrors).toBe(true);
    const failedItems = result.items.filter((i) => !i.passed && i.severity === 'error');
    expect(failedItems).toHaveLength(3);
    const failedNames = failedItems.map((i) => i.name);
    expect(failedNames).toContain('NEXT_PUBLIC_EMPORIX_BASE_URL');
    expect(failedNames).toContain('NEXTAUTH_SECRET');
    expect(failedNames).toContain('NEXT_PUBLIC_DEFAULT_CURRENCY');
  });

  it('should return hasWarnings: true and hasErrors: false when only optional vars are missing', () => {
    delete process.env.NEXT_EMPORIX_CLIENT_ID;
    delete process.env.NEXT_EMPORIX_CLIENT_SECRET;

    const result = validateEnvVars();

    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(true);
    const warningItems = result.items.filter((i) => !i.passed && i.severity === 'warning');
    expect(warningItems).toHaveLength(2);
  });

  it('should treat empty string values as missing', () => {
    process.env.NEXT_PUBLIC_EMPORIX_TENANT = '';

    const result = validateEnvVars();

    expect(result.hasErrors).toBe(true);
    const item = result.items.find((i) => i.name === 'NEXT_PUBLIC_EMPORIX_TENANT');
    expect(item!.passed).toBe(false);
  });

  it('should treat whitespace-only values as missing', () => {
    process.env.NEXT_PUBLIC_EMPORIX_TENANT = '   ';

    const result = validateEnvVars();

    expect(result.hasErrors).toBe(true);
    const item = result.items.find((i) => i.name === 'NEXT_PUBLIC_EMPORIX_TENANT');
    expect(item!.passed).toBe(false);
  });

  it('should show all items as passed when all vars are present', () => {
    const result = validateEnvVars();

    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
    expect(result.items.every((i) => i.passed)).toBe(true);
    for (const item of result.items) {
      expect(item.message).toContain('present');
    }
  });

  it('should never include env var values in messages', () => {
    process.env.NEXTAUTH_SECRET = 'super-secret-value-123';

    const result = validateEnvVars();

    for (const item of result.items) {
      expect(item.message).not.toContain('super-secret-value-123');
      expect(item.message).not.toContain('test-value');
    }
  });

  it('should cover all expected required env var keys', () => {
    expect(allRequiredKeys).toEqual([
      'NEXT_PUBLIC_EMPORIX_BASE_URL',
      'NEXT_PUBLIC_EMPORIX_TENANT',
      'NEXT_PUBLIC_EMPORIX_CLIENT_ID',
      'NEXTAUTH_SECRET',
      'NEXT_PUBLIC_DEFAULT_CURRENCY',
      'NEXT_PUBLIC_DEFAULT_LANGUAGE',
      'NEXT_PUBLIC_DEFAULT_COUNTRY',
      'NEXT_PUBLIC_AVAILABLE_SITES',
    ]);
  });

  it('should cover all expected optional env var keys', () => {
    expect(allOptionalKeys).toEqual([
      'NEXT_PUBLIC_DEFAULT_SITE',
      'NEXT_EMPORIX_CLIENT_ID',
      'NEXT_EMPORIX_CLIENT_SECRET',
    ]);
  });
});
