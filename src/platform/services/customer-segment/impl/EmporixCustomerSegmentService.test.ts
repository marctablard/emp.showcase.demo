import type { EmporixCustomerSegmentApi } from '@/platform/integrations/emporix/customer-segment/EmporixCustomerSegmentApi';
import type {
  CategoryTreeItemResponse,
  ItemAssignmentResponse,
  SegmentResponse,
} from '@/platform/integrations/emporix/model';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import EmporixCustomerSegmentMapper from '@/platform/services/model/customer-segment/impl/EmporixCustomerSegmentMapper';
import type { Session } from '@/platform/services/model/session/session';
import type { SessionService } from '@/platform/services/session';
import { EmporixCustomerSegmentService } from './EmporixCustomerSegmentService';

describe('EmporixCustomerSegmentService', () => {
  const session: Session = {
    id: 'session-1',
    customerId: 'customer-1',
    currency: 'EUR',
    siteCode: 'main',
    legalEntityId: 'le-1',
  };

  // Fixture observed on api-develop (tenant showcasedev, 2026-09-10) for `GET /segments`.
  const solarSegment: SegmentResponse = {
    id: 'solarpanelfans',
    name: { en: 'Solar Panel Buyers' },
    description: { en: 'Customers interested in solar panels' },
    siteCode: 'main',
    status: 'ACTIVE',
    metadata: { version: 1, createdAt: '2026-01-01T00:00:00.000Z' },
  };

  const assignment = (index: number): ItemAssignmentResponse => ({
    segmentId: 'solarpanelfans',
    metadata: { version: 1 },
    item: { id: `product-${index}`, code: `P-${index}`, name: { en: `Product ${index}` } },
    type: 'PRODUCT',
  });

  const assignments = (count: number, offset = 0): ItemAssignmentResponse[] =>
    Array.from({ length: count }, (_, i) => assignment(offset + i));

  let api: jest.Mocked<EmporixCustomerSegmentApi>;
  let sessionService: jest.Mocked<Pick<SessionService, 'getCurrent'>>;
  let logger: jest.Mocked<LoggerService>;
  let service: EmporixCustomerSegmentService;

  beforeEach(() => {
    api = {
      getMySegments: jest.fn(),
      getSegments: jest.fn(),
      getSegmentItems: jest.fn(),
      getCategoryTrees: jest.fn(),
    } as unknown as jest.Mocked<EmporixCustomerSegmentApi>;
    sessionService = { getCurrent: jest.fn().mockResolvedValue(session) };
    logger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    service = new EmporixCustomerSegmentService(
      api,
      new EmporixCustomerSegmentMapper(),
      sessionService as unknown as SessionService,
      logger,
    );
  });

  describe('getMySegments', () => {
    it('uses the me/segments result and does not call getSegments when the primary returns segments with string ids', async () => {
      api.getMySegments.mockResolvedValue([solarSegment]);

      const result = await service.getMySegments();

      expect(result).toEqual([
        { id: 'solarpanelfans', name: { en: 'Solar Panel Buyers' }, status: 'ACTIVE', siteCode: 'main' },
      ]);
      expect(api.getMySegments).toHaveBeenCalledWith({ legalEntityId: 'le-1', siteCode: 'main' });
      expect(api.getSegments).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('falls back to getSegments once and warns when the primary resolves null', async () => {
      api.getMySegments.mockResolvedValue(null);
      api.getSegments.mockResolvedValue([solarSegment]);

      const result = await service.getMySegments();

      expect(result.map((s) => s.id)).toEqual(['solarpanelfans']);
      expect(api.getSegments).toHaveBeenCalledTimes(1);
      expect(api.getSegments).toHaveBeenCalledWith({ legalEntityId: 'le-1', siteCode: 'main', pageSize: 100 });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        { customerId: 'customer-1', reason: 'unavailable' },
        expect.stringContaining('falling back'),
      );
    });

    it('treats a non-empty array without string ids as shape drift: falls back once and warns', async () => {
      api.getMySegments.mockResolvedValue([{ foo: 'bar' } as unknown as SegmentResponse]);
      api.getSegments.mockResolvedValue([solarSegment]);

      const result = await service.getMySegments();

      expect(result.map((s) => s.id)).toEqual(['solarpanelfans']);
      expect(api.getSegments).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith({ customerId: 'customer-1', reason: 'shape-drift' }, expect.any(String));
    });

    it('returns [] without fallback when the primary resolves an empty array', async () => {
      api.getMySegments.mockResolvedValue([]);

      await expect(service.getMySegments()).resolves.toEqual([]);
      expect(api.getSegments).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('drops entries without a string id when at least one entry has one (partial drift)', async () => {
      api.getMySegments.mockResolvedValue([solarSegment, { name: { en: 'broken' } } as unknown as SegmentResponse]);

      const result = await service.getMySegments();

      expect(result.map((s) => s.id)).toEqual(['solarpanelfans']);
      expect(api.getSegments).not.toHaveBeenCalled();
    });

    describe('filtering', () => {
      const past = new Date(Date.now() - 86_400_000).toISOString();
      const future = new Date(Date.now() + 86_400_000).toISOString();

      it('excludes INACTIVE, other-site and expired segments; keeps site-less, status-less and ACTIVE segments for the requested site', async () => {
        api.getMySegments.mockResolvedValue([
          { id: 'inactive', status: 'INACTIVE', siteCode: 'main' },
          { id: 'other-site', status: 'ACTIVE', siteCode: 'other' },
          { id: 'expired', status: 'ACTIVE', siteCode: 'main', validity: { from: past, to: past } },
          { id: 'not-yet', status: 'ACTIVE', siteCode: 'main', validity: { from: future } },
          { id: 'no-site', status: 'ACTIVE' },
          { id: 'no-status', siteCode: 'main' },
          { id: 'current', status: 'ACTIVE', siteCode: 'main', validity: { from: past, to: future } },
          solarSegment,
        ]);

        const result = await service.getMySegments();

        // A missing `status` counts as applicable (fail closed): only an explicit non-ACTIVE status excludes.
        expect(result.map((s) => s.id)).toEqual(['no-site', 'no-status', 'current', 'solarpanelfans']);
      });

      it('logs each dropped segment at debug with its reason and a summary of applicable / dropped ids', async () => {
        api.getMySegments.mockResolvedValue([
          { id: 'inactive', status: 'INACTIVE', siteCode: 'main' },
          { id: 'other-site', status: 'ACTIVE', siteCode: 'other' },
          { id: 'expired', status: 'ACTIVE', siteCode: 'main', validity: { from: past, to: past } },
          solarSegment,
        ]);

        await service.getMySegments();

        const message = 'Customer segment not applicable; excluded from the products mode scope';
        expect(logger.debug).toHaveBeenCalledWith(
          {
            segmentId: 'inactive',
            reason: 'status',
            status: 'INACTIVE',
            segmentSiteCode: 'main',
            requestSiteCode: 'main',
            validity: undefined,
          },
          message,
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ segmentId: 'other-site', reason: 'site', segmentSiteCode: 'other' }),
          message,
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ segmentId: 'expired', reason: 'validity', validity: { from: past, to: past } }),
          message,
        );
        expect(logger.debug).toHaveBeenCalledWith(
          { total: 4, applicable: ['solarpanelfans'], dropped: ['inactive', 'other-site', 'expired'] },
          'Resolved applicable customer segments',
        );
        expect(logger.debug).toHaveBeenCalledTimes(4);
      });

      it('lets options.siteCode win over the session site', async () => {
        api.getMySegments.mockResolvedValue([
          { id: 'main-segment', status: 'ACTIVE', siteCode: 'main' },
          { id: 'other-segment', status: 'ACTIVE', siteCode: 'other' },
        ]);

        const result = await service.getMySegments({ siteCode: 'other' });

        expect(result.map((s) => s.id)).toEqual(['other-segment']);
        expect(api.getMySegments).toHaveBeenCalledWith({ legalEntityId: 'le-1', siteCode: 'other' });
      });

      it('applies the same filtering to the fallback result', async () => {
        api.getMySegments.mockResolvedValue(null);
        api.getSegments.mockResolvedValue([solarSegment, { id: 'inactive', status: 'INACTIVE', siteCode: 'main' }]);

        const result = await service.getMySegments();

        expect(result.map((s) => s.id)).toEqual(['solarpanelfans']);
      });
    });

    it('logs and rethrows a wrapped error when the fallback rejects', async () => {
      api.getMySegments.mockResolvedValue(null);
      api.getSegments.mockRejectedValue(new Error('upstream down'));

      await expect(service.getMySegments()).rejects.toThrow('Failed to retrieve customer segments: upstream down');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error), customerId: 'customer-1' }),
        expect.any(String),
      );
    });
  });

  describe('getSegmentItems', () => {
    it('requests pages 1 and 2 with pageSize 200 and concatenates 350 items when X-Total-Count is 350', async () => {
      api.getSegmentItems
        .mockResolvedValueOnce({ items: assignments(200), totalCount: 350 })
        .mockResolvedValueOnce({ items: assignments(150, 200), totalCount: 350 });

      const result = await service.getSegmentItems();

      expect(result).toHaveLength(350);
      expect(result[0]).toMatchObject({ segmentId: 'solarpanelfans', type: 'PRODUCT', item: { id: 'product-0' } });
      expect(result[349].item.id).toBe('product-349');
      expect(api.getSegmentItems).toHaveBeenCalledTimes(2);
      expect(api.getSegmentItems).toHaveBeenNthCalledWith(1, {
        siteCode: 'main',
        legalEntityId: 'le-1',
        onlyActive: true,
        pageSize: 200,
        pageNumber: 1,
      });
      expect(api.getSegmentItems).toHaveBeenNthCalledWith(2, expect.objectContaining({ pageNumber: 2 }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns a single page when the total fits into one page (api-develop probe: 8 items)', async () => {
      api.getSegmentItems.mockResolvedValueOnce({ items: assignments(8), totalCount: 8 });

      const result = await service.getSegmentItems();

      expect(result).toHaveLength(8);
      expect(api.getSegmentItems).toHaveBeenCalledTimes(1);
    });

    it('forwards q/sort/fields and an explicit siteCode/legalEntityId, always with onlyActive: true', async () => {
      api.getSegmentItems.mockResolvedValueOnce({ items: [], totalCount: 0 });

      await service.getSegmentItems({ q: 'type:PRODUCT', sort: 'segmentId', siteCode: 'other', legalEntityId: 'le-2' });

      expect(api.getSegmentItems).toHaveBeenCalledWith({
        q: 'type:PRODUCT',
        sort: 'segmentId',
        siteCode: 'other',
        legalEntityId: 'le-2',
        onlyActive: true,
        pageSize: 200,
        pageNumber: 1,
      });
    });

    it('stops after one page when X-Total-Count is missing (integration falls back to items.length)', async () => {
      // Integration falls back to `items.length` when the header is missing → totalCount equals the page size.
      api.getSegmentItems.mockResolvedValueOnce({ items: assignments(120), totalCount: 120 });

      const result = await service.getSegmentItems();

      expect(result).toHaveLength(120);
      expect(api.getSegmentItems).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('keeps paging after a short page while X-Total-Count says more items remain', async () => {
      api.getSegmentItems
        .mockResolvedValueOnce({ items: assignments(120), totalCount: 300 })
        .mockResolvedValueOnce({ items: assignments(120, 120), totalCount: 300 })
        .mockResolvedValueOnce({ items: assignments(60, 240), totalCount: 300 });

      const result = await service.getSegmentItems();

      expect(result).toHaveLength(300);
      expect(result[299].item.id).toBe('product-299');
      expect(api.getSegmentItems).toHaveBeenCalledTimes(3);
      expect(api.getSegmentItems).toHaveBeenNthCalledWith(3, expect.objectContaining({ pageNumber: 3 }));
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stops on an empty page and warns about the truncation when X-Total-Count was not reached', async () => {
      api.getSegmentItems
        .mockResolvedValueOnce({ items: assignments(120), totalCount: 300 })
        .mockResolvedValueOnce({ items: [], totalCount: 300 });

      const result = await service.getSegmentItems();

      expect(result).toHaveLength(120);
      expect(api.getSegmentItems).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        { siteCode: 'main', collected: 120, totalCount: 300 },
        expect.stringContaining('truncated'),
      );
    });

    it('stops at the hard cap of 50 pages with a warn', async () => {
      api.getSegmentItems.mockImplementation(async (params) => ({
        items: assignments(200, ((params?.pageNumber ?? 1) - 1) * 200),
        totalCount: 100_000,
      }));

      const result = await service.getSegmentItems();

      expect(api.getSegmentItems).toHaveBeenCalledTimes(50);
      expect(result).toHaveLength(50 * 200);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ maxPages: 50, collected: 10_000, totalCount: 100_000 }),
        expect.stringContaining('hard page cap'),
      );
    });

    it('logs and rethrows a wrapped error when the API rejects', async () => {
      api.getSegmentItems.mockRejectedValue(new Error('boom'));

      await expect(service.getSegmentItems()).rejects.toThrow('Failed to retrieve customer segment items: boom');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.any(String),
      );
    });
  });

  describe('getCategoryTrees', () => {
    const tree: CategoryTreeItemResponse = {
      id: 'root',
      code: 'root',
      name: { en: 'Root' },
      localizedDescription: { en: 'Root description' },
      published: true,
      position: 2,
      isSegmentAssigned: false,
      subcategories: [
        {
          id: 'child',
          name: { en: 'Child' },
          published: true,
          position: 1,
          isSegmentAssigned: true,
          subcategories: [{ id: 'grandchild', name: { en: 'Grandchild' }, isSegmentAssigned: true }],
        },
      ],
    };

    it('preserves the hierarchy, maps isSegmentAssigned → assignedToSegment and passes siteCode to the API', async () => {
      api.getCategoryTrees.mockResolvedValue([tree]);

      const result = await service.getCategoryTrees();

      expect(api.getCategoryTrees).toHaveBeenCalledWith({ siteCode: 'main', legalEntityId: 'le-1' });
      expect(result).toEqual([
        {
          id: 'root',
          parentId: undefined,
          name: { en: 'Root' },
          description: { en: 'Root description' },
          position: 2,
          published: true,
          assignedToSegment: false,
          subcategories: [
            {
              id: 'child',
              parentId: 'root',
              name: { en: 'Child' },
              description: {},
              position: 1,
              published: true,
              assignedToSegment: true,
              subcategories: [
                {
                  id: 'grandchild',
                  parentId: 'child',
                  name: { en: 'Grandchild' },
                  description: {},
                  position: 0,
                  published: false,
                  assignedToSegment: true,
                  subcategories: [],
                },
              ],
            },
          ],
        },
      ]);
    });

    it('lets explicit options override the session siteCode/legalEntityId', async () => {
      api.getCategoryTrees.mockResolvedValue([]);

      await expect(service.getCategoryTrees({ siteCode: 'other', legalEntityId: 'le-2' })).resolves.toEqual([]);

      expect(api.getCategoryTrees).toHaveBeenCalledWith({ siteCode: 'other', legalEntityId: 'le-2' });
    });

    it('logs and rethrows a wrapped error when the API rejects', async () => {
      api.getCategoryTrees.mockRejectedValue(new Error('boom'));

      await expect(service.getCategoryTrees()).rejects.toThrow(
        'Failed to retrieve customer segment category trees: boom',
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.any(String),
      );
    });
  });
});
