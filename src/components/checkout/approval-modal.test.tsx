/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApprovalModal } from './approval-modal';

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });

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
      {
        userId: 'approver-2',
        firstName: 'Zoe',
        lastName: 'Mitchell',
        fullName: 'Zoe Mitchell',
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

// Avoid Radix ScrollArea noise in jsdom (structural stub; type via attribute for inspectability).
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, type, className, ...props }: React.ComponentProps<'div'> & { type?: string }) => (
    // `type` is not a <div> prop — spread it so the stub still exposes it as a DOM attribute.
    <div data-slot="scroll-area" className={className} {...props} {...{ type }}>
      <div data-slot="scroll-area-viewport">{children}</div>
    </div>
  ),
  ScrollBar: () => null,
}));

const defaultProps = {
  onClose: jest.fn(),
  resourceContext: { resourceType: 'QUOTE' as const, resourceId: 'Q-1000', action: 'CHECKOUT' as const },
  approvalSubmit: jest.fn(),
};

describe('ApprovalModal', () => {
  beforeEach(() => {
    defaultProps.onClose = jest.fn();
    defaultProps.approvalSubmit = jest.fn();
  });

  it('focuses the comment field when the dialog opens', async () => {
    render(<ApprovalModal isOpen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-comment')).toHaveFocus();
    });
  });

  it('starts with no preselection, disabled submit, and 0/500 comment counter', async () => {
    render(<ApprovalModal isOpen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-approver-approver-1')).toBeInTheDocument();
    });

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }

    expect(screen.getByTestId('approval-submitButton')).toBeDisabled();
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('enables submit after selecting an approver via the row testid host', async () => {
    render(<ApprovalModal isOpen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-approver-approver-1')).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId('approval-submitButton');
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('approval-approver-approver-1'));

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    expect(screen.getByRole('radio', { name: /Ada Lovelace/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Zoe Mitchell/i })).not.toBeChecked();
  });

  it('clears selection when closed and reopened', async () => {
    const { rerender } = render(<ApprovalModal isOpen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-approver-approver-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('approval-approver-approver-1'));
    await waitFor(() => {
      expect(screen.getByTestId('approval-submitButton')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('approval-cancelButton'));
    expect(defaultProps.onClose).toHaveBeenCalled();

    rerender(<ApprovalModal isOpen={false} {...defaultProps} />);
    rerender(<ApprovalModal isOpen {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-approver-approver-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('approval-submitButton')).toBeDisabled();
    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
  });
});
