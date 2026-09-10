import type { CustomerSegmentService } from '@/platform/services/customer-segment/CustomerSegmentService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Segment } from '@/platform/services/model/customer-segment';
import type { Session } from '@/platform/services/model/session/session';
import type { SearchService } from '@/platform/services/search';
import BatteryIncludedSearchService from '@/platform/services/search/impl/BatteryIncludedSearchService';
import type { SessionService } from '@/platform/services/session';
import DefaultProductsModeService from './DefaultProductsModeService';

const FLAG = 'NEXT_PUBLIC_ALLOW_SEGMENTS_OVERRIDE';

describe('DefaultProductsModeService', () => {
  const originalFlag = process.env[FLAG];

  const customerSession: Session = { id: 'session-1', customerId: 'c1', currency: 'EUR', siteCode: 'main' };
  const anonymousSession: Session = { id: 'session-2', currency: 'EUR', siteCode: 'main' };
  const segments: Segment[] = [
    { id: 's1', status: 'ACTIVE' },
    { id: 's2', status: 'ACTIVE' },
  ];

  const batteryIncludedSearchService = () =>
    new BatteryIncludedSearchService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  const emporixSearchService = () => ({ searchProducts: jest.fn() }) as unknown as SearchService;

  let sessionService: jest.Mocked<Pick<SessionService, 'getCurrent'>>;
  let customerSegmentService: jest.Mocked<Pick<CustomerSegmentService, 'getMySegments'>>;
  let logger: jest.Mocked<LoggerService>;

  const createService = (options: { flag?: 'true' | 'false' | undefined; engine?: 'batteryincluded' | 'emporix' }) => {
    if (options.flag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = options.flag;
    }
    const searchService =
      options.engine === 'emporix' ? emporixSearchService() : (batteryIncludedSearchService() as SearchService);
    return new DefaultProductsModeService(
      sessionService as unknown as SessionService,
      customerSegmentService as unknown as CustomerSegmentService,
      searchService,
      logger,
    );
  };

  beforeEach(() => {
    sessionService = { getCurrent: jest.fn().mockResolvedValue(customerSession) };
    customerSegmentService = { getMySegments: jest.fn().mockResolvedValue(segments) };
    logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
  });

  it('resolves anonymous when the session has no customerId and does not look up segments', async () => {
    sessionService.getCurrent.mockResolvedValue(anonymousSession);
    const service = createService({ flag: 'true' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context).toEqual({
      mode: 'anonymous',
      segmentIds: [],
      canToggleAllProducts: false,
      engine: 'batteryincluded',
      siteCode: 'main',
      customerId: undefined,
    });
    expect(customerSegmentService.getMySegments).not.toHaveBeenCalled();
  });

  it('resolves anonymous for the Emporix "ANONYMOUS" session customerId and does not look up segments', async () => {
    sessionService.getCurrent.mockResolvedValue({ ...anonymousSession, customerId: 'ANONYMOUS' });
    const service = createService({ flag: 'true' });

    const context = await service.resolve({ optInCookieValue: 'all.ANONYMOUS' });

    expect(context).toEqual({
      mode: 'anonymous',
      segmentIds: [],
      canToggleAllProducts: false,
      engine: 'batteryincluded',
      siteCode: 'main',
      customerId: undefined,
    });
    expect(customerSegmentService.getMySegments).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('resolves unsegmented when the customer has no active segments', async () => {
    customerSegmentService.getMySegments.mockResolvedValue([]);
    const service = createService({ flag: 'true' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context).toEqual({
      mode: 'unsegmented',
      segmentIds: [],
      canToggleAllProducts: false,
      engine: 'batteryincluded',
      siteCode: 'main',
      customerId: 'c1',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('ignores the opt-in cookie when the flag is off (hard rule) and resolves assigned', async () => {
    const service = createService({ flag: undefined });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(false);
    expect(context.segmentIds).toEqual(['s1', 's2']);
  });

  it('treats a non-"true" flag value as off', async () => {
    const service = createService({ flag: 'false' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(false);
  });

  it('resolves all for a segmented customer with flag on, BatteryIncluded engine and a valid cookie', async () => {
    const service = createService({ flag: 'true', engine: 'batteryincluded' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context).toEqual({
      mode: 'all',
      segmentIds: ['s1', 's2'],
      canToggleAllProducts: true,
      engine: 'batteryincluded',
      siteCode: 'main',
      customerId: 'c1',
    });
  });

  it('resolves assigned (toggle allowed) when the cookie is bound to another customer id', async () => {
    const service = createService({ flag: 'true', engine: 'batteryincluded' });

    const context = await service.resolve({ optInCookieValue: 'all.c2' });

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(true);
  });

  it('resolves assigned (toggle allowed) when no cookie is present', async () => {
    const service = createService({ flag: 'true', engine: 'batteryincluded' });

    const context = await service.resolve({});

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(true);
  });

  it('resolves all on the Emporix engine with flag on and a valid cookie (engine-agnostic)', async () => {
    const service = createService({ flag: 'true', engine: 'emporix' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context).toEqual({
      mode: 'all',
      segmentIds: ['s1', 's2'],
      canToggleAllProducts: true,
      engine: 'emporix',
      siteCode: 'main',
      customerId: 'c1',
    });
  });

  it('resolves assigned (toggle allowed) on the Emporix engine with flag on and no cookie', async () => {
    const service = createService({ flag: 'true', engine: 'emporix' });

    const context = await service.resolve({});

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(true);
    expect(context.engine).toBe('emporix');
  });

  it('ignores the opt-in cookie on the Emporix engine when the flag is off', async () => {
    const service = createService({ flag: 'false', engine: 'emporix' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context.mode).toBe('assigned');
    expect(context.canToggleAllProducts).toBe(false);
    expect(context.engine).toBe('emporix');
  });

  it('fails closed when the segment lookup rejects: assigned, no segments, no toggle, error logged', async () => {
    const failure = new Error('Failed to retrieve customer segments: upstream down');
    customerSegmentService.getMySegments.mockRejectedValue(failure);
    const service = createService({ flag: 'true', engine: 'batteryincluded' });

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context).toEqual({
      mode: 'assigned',
      segmentIds: [],
      canToggleAllProducts: false,
      engine: 'batteryincluded',
      siteCode: 'main',
      customerId: 'c1',
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, customerId: 'c1' }),
      expect.any(String),
    );
  });

  it('forwards the input siteCode to getMySegments and echoes it in the context', async () => {
    const service = createService({ flag: 'true' });

    const context = await service.resolve({ siteCode: 'us-branch' });

    expect(customerSegmentService.getMySegments).toHaveBeenCalledWith({ siteCode: 'us-branch' });
    expect(context.siteCode).toBe('us-branch');
  });

  it('uses the session site for getMySegments and the context when no siteCode is given', async () => {
    const service = createService({ flag: 'true' });

    const context = await service.resolve({});

    expect(customerSegmentService.getMySegments).toHaveBeenCalledWith({ siteCode: 'main' });
    expect(context.siteCode).toBe('main');
  });

  it('parses the flag once in the constructor and does not re-read process.env per call', async () => {
    const service = createService({ flag: 'true' });
    process.env[FLAG] = 'false';

    const context = await service.resolve({ optInCookieValue: 'all.c1' });

    expect(context.mode).toBe('all');
    expect(context.canToggleAllProducts).toBe(true);
  });
});
