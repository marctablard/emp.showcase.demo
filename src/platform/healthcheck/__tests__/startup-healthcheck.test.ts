import type { Container } from 'inversify';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { validateRemoteConfig } from '../remote-validation';
import { runStartupHealthcheck } from '../startup-healthcheck';
import type { HealthcheckResult } from '../types';

// Mock the remote-validation module
jest.mock('../remote-validation');
// Mock the i18n routing module
jest.mock('@/i18n/routing', () => ({
  routingConfig: { locales: ['en', 'de'] },
}));

const mockedValidateRemoteConfig = validateRemoteConfig as jest.MockedFunction<typeof validateRemoteConfig>;

function createMockLogger(): jest.Mocked<LoggerService> {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

function createMockContainer(mockLogger: jest.Mocked<LoggerService>): jest.Mocked<Container> {
  const mockSiteSettingsApi = { getSite: jest.fn() };
  const mockCurrencyApi = { getCurrencies: jest.fn() };

  return {
    get: jest.fn((id: string) => {
      switch (id) {
        case 'LoggerService':
          return mockLogger;
        case 'EmporixSiteSettingsApi':
          return mockSiteSettingsApi;
        case 'EmporixCurrencyApi':
          return mockCurrencyApi;
        default:
          throw new Error(`Unknown service: ${id}`);
      }
    }),
  } as unknown as jest.Mocked<Container>;
}

function allPassedResult(): HealthcheckResult {
  return {
    tier: 'remote',
    items: [
      { name: 'currency:EUR', passed: true, severity: 'error', message: 'Default currency "EUR" exists' },
      { name: 'site:main', passed: true, severity: 'error', message: 'Site "main" exists' },
    ],
    hasErrors: false,
    hasWarnings: false,
  };
}

function warningResult(): HealthcheckResult {
  return {
    tier: 'remote',
    items: [{ name: 'site:missing', passed: false, severity: 'warning', message: 'Site "missing" not found' }],
    hasErrors: false,
    hasWarnings: true,
  };
}

function errorResult(): HealthcheckResult {
  return {
    tier: 'remote',
    items: [{ name: 'site:broken', passed: false, severity: 'error', message: 'Site "broken" critically invalid' }],
    hasErrors: true,
    hasWarnings: false,
  };
}

function apiUnreachableResult(): HealthcheckResult {
  return {
    tier: 'remote',
    items: [
      {
        name: 'api-connectivity',
        passed: false,
        severity: 'warning',
        message: 'Remote validation skipped: API unreachable',
      },
    ],
    hasErrors: false,
    hasWarnings: true,
  };
}

describe('runStartupHealthcheck', () => {
  let mockLogger: jest.Mocked<LoggerService>;
  let mockContainer: jest.Mocked<Container>;
  let savedEnv: NodeJS.ProcessEnv;
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  beforeEach(() => {
    savedEnv = { ...process.env };
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'main';
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = 'EUR';
    delete process.env.NEXT_STARTUP_HEALTHCHECK_ENABLED;

    mockLogger = createMockLogger();
    mockContainer = createMockContainer(mockLogger);
    mockedValidateRemoteConfig.mockReset();
    mockExit.mockClear();
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  it('should return early when NEXT_STARTUP_HEALTHCHECK_ENABLED=false', async () => {
    process.env.NEXT_STARTUP_HEALTHCHECK_ENABLED = 'false';

    await runStartupHealthcheck(mockContainer);

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    expect(mockedValidateRemoteConfig).not.toHaveBeenCalled();
  });

  it('should run validation and log success when all checks pass', async () => {
    mockedValidateRemoteConfig.mockResolvedValue(allPassedResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockedValidateRemoteConfig).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ passed: 2 }),
      expect.stringContaining('0 warnings'),
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should call process.exit(1) when Tier 2 has errors', async () => {
    mockedValidateRemoteConfig.mockResolvedValue(errorResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockLogger.fatal).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should log warnings but NOT exit when Tier 2 has warnings only', async () => {
    mockedValidateRemoteConfig.mockResolvedValue(warningResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should log warning about unreachable API but NOT exit', async () => {
    mockedValidateRemoteConfig.mockResolvedValue(apiUnreachableResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should resolve services from the container correctly', async () => {
    mockedValidateRemoteConfig.mockResolvedValue(allPassedResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockContainer.get).toHaveBeenCalledWith('LoggerService');
    expect(mockContainer.get).toHaveBeenCalledWith('EmporixSiteSettingsApi');
    expect(mockContainer.get).toHaveBeenCalledWith('EmporixCurrencyApi');
  });

  it('should pass configured sites and currency from env to validateRemoteConfig', async () => {
    process.env.NEXT_PUBLIC_AVAILABLE_SITES = 'site-a,site-b';
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY = 'GBP';
    mockedValidateRemoteConfig.mockResolvedValue(allPassedResult());

    await runStartupHealthcheck(mockContainer);

    expect(mockedValidateRemoteConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        configuredSites: ['site-a', 'site-b'],
        defaultCurrency: 'GBP',
        configuredLocales: ['en', 'de'],
      }),
    );
  });
});
