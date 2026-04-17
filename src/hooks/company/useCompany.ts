'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCurrentCompany } from '@/lib/client/company';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Company } from '@/platform/services/model/company/company';

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'canceled';
  items: number;
}

export interface Return {
  id: string;
  orderId: string;
  date: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed';
  items: number;
}

export interface Quote {
  id: string;
  date: string;
  total: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: string;
}

export interface Approval {
  id: string;
  type: 'order' | 'quote' | 'return';
  referenceId: string;
  requestedBy: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface CompanyFinancials {
  revenue: number;
  budget: number;
  currency: string;
}

export interface MockCompany extends Company {
  orders: Order[];
  returns: Return[];
  quotes: Quote[];
  approvals: Approval[];
  financials: CompanyFinancials;
}

interface CompanyHook {
  company: MockCompany | null | undefined;
  loading: boolean;
  error: Error | null;
  orderSummary: { total: number; inProgress: number };
  returnSummary: { total: number; open: number };
  pendingApprovals: number;

  // Approval methods
  getAllApprovals: () => Approval[];
  getPendingApprovals: () => Approval[];
  getCompletedApprovals: () => Approval[];
  getApprovalById: (id: string) => Approval | undefined;
  approveApproval: (id: string) => Promise<boolean>;
  rejectApproval: (id: string) => Promise<boolean>;
  getApprovalCountsThisMonth: () => { pending: number; total: number };
  refresh: () => void;
}

/**
 * Hook for company data
 * @returns Company data and state
 */
export const useCompany = (): CompanyHook => {
  // Mock data for company
  const mockCompany: MockCompany = useMemo(
    () => ({
      id: 'comp-789012',
      name: 'Acme Corporation',
      orders: [
        {
          id: 'ord-001',
          date: '2025-05-20T10:30:00',
          total: 1250.99,
          status: 'delivered',
          items: 5,
        },
        {
          id: 'ord-002',
          date: '2025-05-22T14:45:00',
          total: 799.5,
          status: 'processing',
          items: 3,
        },
        {
          id: 'ord-003',
          date: '2025-05-24T09:15:00',
          total: 349.99,
          status: 'pending',
          items: 2,
        },
        {
          id: 'ord-004',
          date: '2025-05-25T16:20:00',
          total: 1599.95,
          status: 'processing',
          items: 7,
        },
        {
          id: 'ord-005',
          date: '2025-05-27T11:10:00',
          total: 499.99,
          status: 'processing',
          items: 1,
        },
      ],
      returns: [
        {
          id: 'ret-001',
          orderId: 'ord-001',
          date: '2025-05-26T13:40:00',
          status: 'completed',
          items: 1,
        },
        {
          id: 'ret-002',
          orderId: 'ord-002',
          date: '2025-05-27T15:30:00',
          status: 'pending',
          items: 1,
        },
      ],
      quotes: [
        {
          id: 'quo-001',
          date: '2025-05-15T10:00:00',
          total: 2499.99,
          status: 'approved',
          expiresAt: '2025-06-15T10:00:00',
        },
        {
          id: 'quo-002',
          date: '2025-05-20T14:30:00',
          total: 1899.95,
          status: 'pending',
          expiresAt: '2025-06-20T14:30:00',
        },
        {
          id: 'quo-003',
          date: '2025-05-25T09:45:00',
          total: 3299.99,
          status: 'pending',
          expiresAt: '2025-06-25T09:45:00',
        },
      ],
      approvals: [
        {
          id: 'apr-001',
          type: 'order',
          referenceId: 'ord-003',
          requestedBy: 'Jane Smith',
          date: '2025-05-24T09:30:00',
          status: 'pending',
        },
        {
          id: 'apr-002',
          type: 'quote',
          referenceId: 'quo-002',
          requestedBy: 'Bob Johnson',
          date: '2025-05-20T15:00:00',
          status: 'pending',
        },
        {
          id: 'apr-003',
          type: 'quote',
          referenceId: 'quo-003',
          requestedBy: 'Alice Williams',
          date: '2025-05-25T10:15:00',
          status: 'pending',
        },
      ],
      financials: {
        revenue: 2500.0,
        budget: 5000.0,
        currency: 'USD',
      },
    }),
    [],
  );

  const [company, setCompany] = useState<MockCompany | null | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Calculate order summary
  const orderSummary = {
    total: company?.orders.length || 0,
    inProgress:
      company?.orders.filter((order) => order.status === 'pending' || order.status === 'processing').length || 0,
  };

  // Calculate return summary
  const returnSummary = {
    total: company?.returns.length || 0,
    open:
      company?.returns.filter((returnItem) => returnItem.status === 'pending' || returnItem.status === 'processing')
        .length || 0,
  };

  // Calculate pending approvals
  const pendingApprovals = company?.approvals.filter((approval) => approval.status === 'pending').length || 0;

  // Approval management methods
  const getAllApprovals = (): Approval[] => {
    return company?.approvals || [];
  };

  const getPendingApprovals = (): Approval[] => {
    return company?.approvals.filter((approval) => approval.status === 'pending') || [];
  };

  const getCompletedApprovals = (): Approval[] => {
    return (
      company?.approvals.filter((approval) => approval.status === 'approved' || approval.status === 'rejected') || []
    );
  };

  const getApprovalById = (id: string): Approval | undefined => {
    return company?.approvals.find((approval) => approval.id === id);
  };

  const approveApproval = async (id: string): Promise<boolean> => {
    if (!company) return false;

    // In a real implementation, this would be an API call
    // For now, we'll update the local state
    company.approvals.map((approval) => (approval.id === id ? { ...approval, status: 'approved' } : approval));

    // Update company state would happen here in a real implementation
    // For mock purposes, we'll just log the action
    getLogger().info({ approvalId: id }, 'Approval has been approved');
    return true;
  };

  const rejectApproval = async (id: string): Promise<boolean> => {
    if (!company) return false;

    // In a real implementation, this would be an API call
    // For now, we'll update the local state
    company.approvals.map((approval) => (approval.id === id ? { ...approval, status: 'rejected' } : approval));

    // Update company state would happen here in a real implementation
    // For mock purposes, we'll just log the action
    getLogger().info({ approvalId: id }, 'Approval has been rejected');
    return true;
  };

  const getApprovalCountsThisMonth = (): { pending: number; total: number } => {
    if (!company) return { pending: 0, total: 0 };

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthApprovals = company.approvals.filter((approval) => {
      const approvalDate = new Date(approval.date);
      return approvalDate >= firstDayOfMonth;
    });

    const pendingThisMonth = thisMonthApprovals.filter((approval) => approval.status === 'pending').length;

    return {
      pending: pendingThisMonth,
      total: thisMonthApprovals.length,
    };
  };

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    try {
      const company = await fetchCurrentCompany();
      if (company) {
        setCompany({
          ...mockCompany,
          id: company.id,
          name: company.name,
          onboarding: company.onboarding,
        });
      }
    } catch (error) {
      getLogger().error({ err: error }, 'Error fetching company');
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [setCompany, setLoading, setError, mockCompany]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const refresh = () => {
    fetchCompany();
  };

  return {
    company,
    loading,
    error,
    orderSummary,
    returnSummary,
    pendingApprovals,
    getAllApprovals,
    getPendingApprovals,
    getCompletedApprovals,
    getApprovalById,
    approveApproval,
    rejectApproval,
    getApprovalCountsThisMonth,
    refresh,
  };
};

export default useCompany;
