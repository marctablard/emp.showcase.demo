import type { ApprovalStatus } from '@/platform/services/model/approval';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import {
  getApprovalStatusVariant,
  getOrderStatusVariant,
  getQuoteStatusVariant,
  getReturnStatusVariant,
  isApprovalStatusValue,
  isOrderStatusValue,
  isQuoteStatusValue,
  isReturnStatusValue,
} from './status-tag-variants';

describe('status-tag-variants', () => {
  describe('getOrderStatusVariant', () => {
    it('maps every ORDER_STATUS value', () => {
      for (const status of Object.values(ORDER_STATUS)) {
        expect(getOrderStatusVariant(status)).toEqual(expect.any(String));
      }
    });

    it('maps CONFIRMED to success (Figma order tag)', () => {
      expect(getOrderStatusVariant('CONFIRMED')).toBe('success');
    });

    it('maps COMPLETED to muted (Figma final gray tag)', () => {
      expect(getOrderStatusVariant('COMPLETED')).toBe('muted');
    });

    it('maps SHIPPED to success', () => {
      expect(getOrderStatusVariant('SHIPPED')).toBe('success');
    });

    it('maps DELIVERED to muted', () => {
      expect(getOrderStatusVariant('DELIVERED')).toBe('muted');
    });

    it('maps CREATED to information', () => {
      expect(getOrderStatusVariant('CREATED')).toBe('information');
    });

    it('maps DECLINED to destructive', () => {
      expect(getOrderStatusVariant('DECLINED')).toBe('destructive');
    });
  });

  describe('getQuoteStatusVariant', () => {
    const quoteStatuses = [
      'CREATING',
      'OPEN',
      'IN_PROGRESS',
      'DECLINED',
      'ACCEPTED',
      'ORDER_CREATED',
      'CLOSED',
      'CHANGE',
      'DECLINE',
      'DECLINED_BY_MERCHANT',
      'EXPIRED',
    ] as const;

    it('maps every QuoteStatus value', () => {
      for (const status of quoteStatuses) {
        expect(isQuoteStatusValue(status)).toBe(true);
        expect(getQuoteStatusVariant(status)).toEqual(expect.any(String));
      }
    });

    it('maps OPEN to information', () => {
      expect(getQuoteStatusVariant('OPEN')).toBe('information');
    });

    it('maps EXPIRED to outline', () => {
      expect(getQuoteStatusVariant('EXPIRED')).toBe('outline');
    });

    it('maps CLOSED to muted', () => {
      expect(getQuoteStatusVariant('CLOSED')).toBe('muted');
    });

    it('maps CREATING to information', () => {
      expect(getQuoteStatusVariant('CREATING')).toBe('information');
    });

    it('maps CHANGE to destructive', () => {
      expect(getQuoteStatusVariant('CHANGE')).toBe('destructive');
    });
  });

  describe('getReturnStatusVariant', () => {
    const returnStatuses = ['APPROVED', 'PENDING', 'REJECTED', 'REVIEWED', 'CLOSED'] as const;

    it('maps every ReturnStatus value', () => {
      for (const status of returnStatuses) {
        expect(isReturnStatusValue(status)).toBe(true);
        expect(getReturnStatusVariant(status)).toEqual(expect.any(String));
      }
    });

    it('maps APPROVED to success', () => {
      expect(getReturnStatusVariant('APPROVED')).toBe('success');
    });

    it('maps REVIEWED to warning (same in-progress family as PENDING)', () => {
      expect(getReturnStatusVariant('REVIEWED')).toBe('warning');
    });

    it('maps CLOSED to muted', () => {
      expect(getReturnStatusVariant('CLOSED')).toBe('muted');
    });
  });

  describe('getApprovalStatusVariant', () => {
    const approvalStatuses: ApprovalStatus[] = ['PENDING', 'APPROVED', 'CLOSED', 'EXPIRED', 'DECLINED'];

    it('maps every ApprovalStatus value', () => {
      for (const status of approvalStatuses) {
        expect(isApprovalStatusValue(status)).toBe(true);
        expect(getApprovalStatusVariant(status)).toEqual(expect.any(String));
      }
    });

    it('maps PENDING to warning', () => {
      expect(getApprovalStatusVariant('PENDING')).toBe('warning');
    });

    it('maps EXPIRED to muted', () => {
      expect(getApprovalStatusVariant('EXPIRED')).toBe('muted');
    });

    it('maps CLOSED to muted', () => {
      expect(getApprovalStatusVariant('CLOSED')).toBe('muted');
    });

    it('falls back to default variant for unknown runtime values', () => {
      expect(getApprovalStatusVariant('UNKNOWN' as ApprovalStatus)).toBe('default');
    });
  });

  describe('isOrderStatusValue', () => {
    it('accepts all order statuses', () => {
      for (const status of Object.values(ORDER_STATUS)) {
        expect(isOrderStatusValue(status)).toBe(true);
      }
    });

    it('rejects garbage', () => {
      expect(isOrderStatusValue('FAKE')).toBe(false);
    });
  });
});
