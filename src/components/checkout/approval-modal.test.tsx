/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { ApprovalModal } from './approval-modal';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/approval/useApproverSearch', () => ({
  useApproverSearch: () => ({
    approvers: [
      {
        userId: 'approver-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    ],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

describe('ApprovalModal', () => {
  it('focuses the comment field when the dialog opens', async () => {
    render(
      <ApprovalModal
        isOpen
        onClose={jest.fn()}
        resourceContext={{ resourceType: 'QUOTE', resourceId: 'Q-1000', action: 'CHECKOUT' }}
        approvalSubmit={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('approval-comment')).toHaveFocus();
    });
  });
});
