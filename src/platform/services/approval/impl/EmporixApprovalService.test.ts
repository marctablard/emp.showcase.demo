import type { EmporixApprovalApi } from '@/platform/integrations/emporix/approval/EmporixApprovalApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import { ApprovalAlreadyExistsError, ApprovalApproverNotPermittedError } from '@/platform/services/approval/errors';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ApprovalCreateRequest } from '@/platform/services/model/approval';
import type { EmporixApprovalMapper } from '@/platform/services/model/approval/impl/EmporixApprovalMapper';
import EmporixApprovalService from './EmporixApprovalService';

describe('EmporixApprovalService', () => {
  let approvalService: EmporixApprovalService;
  let mockApprovalApi: jest.Mocked<
    Pick<
      EmporixApprovalApi,
      'checkApprovalPermitted' | 'searchApprovalUsers' | 'createApproval' | 'getApprovals' | 'getApproval'
    >
  >;
  let mockApprovalMapper: jest.Mocked<Pick<EmporixApprovalMapper, 'mapCreateRequestToSource' | 'mapToService'>>;
  let mockLogger: jest.Mocked<Pick<LoggerService, 'info' | 'warn'>>;
  let mockQuoteService: { getQuote: jest.Mock };

  const approvalRequest: ApprovalCreateRequest = {
    resourceId: 'quote-1',
    resourceType: 'QUOTE',
    action: 'CHECKOUT',
    approver: { userId: 'approver-1' },
    comment: 'Please review',
  };

  beforeEach(() => {
    mockApprovalApi = {
      checkApprovalPermitted: jest.fn().mockResolvedValue({ action: 'CHECKOUT', permitted: false }),
      searchApprovalUsers: jest.fn().mockResolvedValue([
        {
          userId: 'approver-1',
          firstName: 'Taylor',
          lastName: 'Approver',
        },
      ]),
      createApproval: jest.fn().mockResolvedValue({ id: 'approval-1' }),
      getApprovals: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      getApproval: jest.fn(),
    };

    mockApprovalMapper = {
      mapToService: jest.fn(),
      mapCreateRequestToSource: jest.fn().mockReturnValue({
        resourceId: 'quote-1',
        resourceType: 'QUOTE',
        action: 'CHECKOUT',
        approver: { userId: 'approver-1' },
        comment: 'Please review',
      }),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    mockQuoteService = { getQuote: jest.fn() };

    approvalService = new EmporixApprovalService(
      {} as EmporixIamApi,
      mockApprovalApi as unknown as EmporixApprovalApi,
      mockApprovalMapper as unknown as EmporixApprovalMapper,
      mockQuoteService as never,
      {} as CustomerService,
      mockLogger as unknown as LoggerService,
    );
  });

  it('rejects approval creation when the selected approver is not permitted for the resource', async () => {
    mockApprovalApi.searchApprovalUsers.mockResolvedValueOnce([
      {
        userId: 'approver-9',
        firstName: 'Other',
        lastName: 'Approver',
      },
    ]);

    const createApprovalPromise = approvalService.createApproval(approvalRequest);

    await expect(createApprovalPromise).rejects.toBeInstanceOf(ApprovalApproverNotPermittedError);
    await expect(createApprovalPromise).rejects.toMatchObject({ approverId: 'approver-1' });

    expect(mockApprovalApi.searchApprovalUsers).toHaveBeenCalledWith({
      resourceId: 'quote-1',
      resourceType: 'QUOTE',
      action: 'CHECKOUT',
    });
    expect(mockApprovalMapper.mapCreateRequestToSource).not.toHaveBeenCalled();
    expect(mockApprovalApi.createApproval).not.toHaveBeenCalled();
  });

  it('keeps duplicate prevention ahead of approver validation', async () => {
    mockApprovalApi.checkApprovalPermitted.mockResolvedValueOnce({
      action: 'CHECKOUT',
      permitted: false,
      approvalId: 'approval-existing-1',
    });

    const createApprovalPromise = approvalService.createApproval(approvalRequest);

    await expect(createApprovalPromise).rejects.toBeInstanceOf(ApprovalAlreadyExistsError);
    await expect(createApprovalPromise).rejects.toMatchObject({ approvalId: 'approval-existing-1' });

    expect(mockApprovalApi.searchApprovalUsers).not.toHaveBeenCalled();
    expect(mockApprovalMapper.mapCreateRequestToSource).not.toHaveBeenCalled();
    expect(mockApprovalApi.createApproval).not.toHaveBeenCalled();
  });

  it('maps create failures to duplicate approvals when a re-check finds the new approval', async () => {
    mockApprovalApi.createApproval.mockRejectedValueOnce(new Error('Failed to create approval'));
    mockApprovalApi.checkApprovalPermitted
      .mockResolvedValueOnce({ action: 'CHECKOUT', permitted: false })
      .mockResolvedValueOnce({ action: 'CHECKOUT', permitted: false, approvalId: 'approval-existing-2' });

    const createApprovalPromise = approvalService.createApproval(approvalRequest);

    await expect(createApprovalPromise).rejects.toBeInstanceOf(ApprovalAlreadyExistsError);
    await expect(createApprovalPromise).rejects.toMatchObject({ approvalId: 'approval-existing-2' });
  });

  it('preserves the original create error when the duplicate re-check also fails', async () => {
    const createError = new Error('Failed to create approval');

    mockApprovalApi.createApproval.mockRejectedValueOnce(createError);
    mockApprovalApi.checkApprovalPermitted
      .mockResolvedValueOnce({ action: 'CHECKOUT', permitted: false })
      .mockRejectedValueOnce(new Error('Failed to re-check approval state'));

    await expect(approvalService.createApproval(approvalRequest)).rejects.toBe(createError);
  });

  it('logs only aggregate approval identifiers before mapping', async () => {
    mockApprovalApi.getApprovals.mockResolvedValueOnce({
      items: [
        {
          id: 'approval-1',
          resourceType: 'QUOTE',
          action: 'CHECKOUT',
          status: 'PENDING',
          resource: { id: 'quote-1' },
          requestor: {
            userId: 'requestor-1',
            firstName: 'Requester',
            lastName: 'One',
            email: 'requestor@example.com',
          },
          approver: {
            userId: 'approver-1',
            firstName: 'Approver',
            lastName: 'One',
            email: 'approver@example.com',
          },
          comment: 'Please review',
          metadata: {
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-01T11:00:00.000Z',
            version: 3,
          },
        } as never,
      ],
      totalCount: 1,
    });
    mockApprovalMapper.mapToService.mockReturnValueOnce({ id: 'approval-1' } as never);

    const result = await approvalService.getApprovals(1, 60, 'createdAt:desc');

    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        pageNumber: 1,
        pageSize: 60,
        sort: 'createdAt:desc',
        query: null,
        approvalsCount: 1,
        approvalIds: ['approval-1'],
      },
      'Emporix approvals list response summary',
    );
    expect(mockApprovalMapper.mapToService).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [{ id: 'approval-1' }], totalCount: 1 });
  });

  it('enriches a QUOTE approval with quote shipping on getApproval', async () => {
    mockApprovalApi.getApproval = jest.fn().mockResolvedValue({ id: 'approval-q' });
    mockApprovalMapper.mapToService.mockReturnValueOnce({
      id: 'approval-q',
      resourceType: 'QUOTE',
      resource: { id: 'Q1000510' },
    } as never);
    mockQuoteService.getQuote.mockResolvedValueOnce({
      id: 'Q1000510',
      currency: 'EUR',
      shippingCost: 20,
      shippingGross: 21.4,
      shippingMethod: 'DHL',
      items: [],
    });

    const result = await approvalService.getApproval('approval-q');

    expect(mockQuoteService.getQuote).toHaveBeenCalledWith('Q1000510');
    expect(result?.details?.shipping?.amount).toBe(20);
    expect(result?.details?.shipping?.methodName).toBe('DHL');
    expect(result?.details?.shipping?.grossAmount).toBe(21.4);
  });

  it('does not load a quote when getting a CART approval', async () => {
    mockApprovalApi.getApproval.mockResolvedValueOnce({ id: 'approval-c' } as never);
    mockApprovalMapper.mapToService.mockReturnValueOnce({
      id: 'approval-c',
      resourceType: 'CART',
      resource: { id: 'cart-1' },
      details: {
        currency: 'EUR',
        shipping: { methodId: 'dhl', methodName: 'DHL', amount: 10, zoneId: 'de' },
      },
    } as never);

    const result = await approvalService.getApproval('approval-c');

    expect(mockQuoteService.getQuote).not.toHaveBeenCalled();
    expect(result?.details?.shipping?.amount).toBe(10);
  });

  it('returns the mapped approval when quote enrichment fails', async () => {
    mockApprovalApi.getApproval.mockResolvedValueOnce({ id: 'approval-q' } as never);
    mockApprovalMapper.mapToService.mockReturnValueOnce({
      id: 'approval-q',
      resourceType: 'QUOTE',
      resource: { id: 'Q1000510' },
    } as never);
    mockQuoteService.getQuote.mockRejectedValueOnce(new Error('quote unavailable'));

    const result = await approvalService.getApproval('approval-q');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'approval-q',
        resourceType: 'QUOTE',
      }),
    );
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
