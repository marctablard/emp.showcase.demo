import type { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GET } from './route';

/**
 * Route-level tests for `GET /api/tax`. Focus: TaxService + LoggerService only,
 * missing countryCode is 400, unknown country is 200 with an empty list.
 */

jest.mock('@/platform/server', () => {
  const services = new Map<string, unknown>();
  return {
    __esModule: true,
    default: {
      get: jest.fn((id: string) => services.get(id)),
      __services: services,
    },
  };
});

const mockedServer = jest.requireMock('@/platform/server') as {
  default: { get: jest.Mock; __services: Map<string, unknown> };
};

type MockService = { [method: string]: jest.Mock };

function createRequest(search: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/tax${search}`) } as unknown as NextRequest;
}

describe('GET /api/tax', () => {
  let taxService: MockService;
  let logger: MockService;

  beforeEach(() => {
    taxService = {
      getTaxClasses: jest.fn(),
      getTaxRate: jest.fn(),
    };
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn(),
    };

    mockedServer.default.__services.clear();
    mockedServer.default.__services.set('TaxService', taxService);
    mockedServer.default.__services.set('LoggerService', logger);
    mockedServer.default.get.mockImplementation((id: string) => mockedServer.default.__services.get(id));
  });

  it('does not import EmporixTaxApi', () => {
    const source = readFileSync(join(__dirname, 'route.ts'), 'utf8');
    expect(source).not.toMatch(/EmporixTaxApi/);
    expect(source).not.toMatch(/@\/platform\/integrations/);
  });

  it('returns 400 when countryCode is missing', async () => {
    const response = await GET(createRequest(''));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Missing required parameter: countryCode' });
    expect(taxService.getTaxClasses).not.toHaveBeenCalled();
    expect(taxService.getTaxRate).not.toHaveBeenCalled();
  });

  it('returns 400 when countryCode is empty or whitespace', async () => {
    const empty = await GET(createRequest('?countryCode='));
    const whitespace = await GET(createRequest('?countryCode=%20%20'));

    expect(empty.status).toBe(400);
    expect(whitespace.status).toBe(400);
    expect(taxService.getTaxClasses).not.toHaveBeenCalled();
  });

  it('returns the country tax class list', async () => {
    const taxClasses = [
      { code: 'STANDARD', rate: 7.7 },
      { code: 'REDUCED', rate: 3.7 },
      { code: 'ZERO', rate: 0 },
    ];
    taxService.getTaxClasses.mockResolvedValue(taxClasses);

    const response = await GET(createRequest('?countryCode=CH'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ countryCode: 'CH', taxClasses });
    expect(taxService.getTaxClasses).toHaveBeenCalledWith('CH');
    expect(taxService.getTaxRate).not.toHaveBeenCalled();
    expect(mockedServer.default.get.mock.calls.every(([id]) => id === 'TaxService' || id === 'LoggerService')).toBe(
      true,
    );
  });

  it('returns 200 with an empty list when the country has no tax configuration', async () => {
    taxService.getTaxClasses.mockResolvedValue([]);

    const response = await GET(createRequest('?countryCode=XX'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ countryCode: 'XX', taxClasses: [] });
  });

  it('returns at most the matching class when taxCode is provided', async () => {
    taxService.getTaxRate.mockResolvedValue(7.7);

    const response = await GET(createRequest('?countryCode=CH&taxCode=STANDARD'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      countryCode: 'CH',
      taxClasses: [{ code: 'STANDARD', rate: 7.7 }],
    });
    expect(taxService.getTaxRate).toHaveBeenCalledWith('CH', 'STANDARD');
    expect(taxService.getTaxClasses).not.toHaveBeenCalled();
  });

  it('includes rate 0 when the matching class exists', async () => {
    taxService.getTaxRate.mockResolvedValue(0);

    const response = await GET(createRequest('?countryCode=CH&taxCode=ZERO'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      countryCode: 'CH',
      taxClasses: [{ code: 'ZERO', rate: 0 }],
    });
  });

  it('returns an empty list when getTaxRate is undefined for the taxCode', async () => {
    taxService.getTaxRate.mockResolvedValue(undefined);

    const response = await GET(createRequest('?countryCode=CH&taxCode=MISSING'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ countryCode: 'CH', taxClasses: [] });
  });

  it('logs and returns 500 when TaxService fails', async () => {
    taxService.getTaxClasses.mockRejectedValue(new Error('Failed to get tax configuration: Forbidden'));

    const response = await GET(createRequest('?countryCode=CH'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch tax classes' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Failed to get tax configuration: Forbidden',
        path: '/api/tax',
        method: 'GET',
        countryCode: 'CH',
      }),
      'Error fetching tax classes',
    );
  });
});
