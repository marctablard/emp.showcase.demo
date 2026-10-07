/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApproverSelectList } from '@/components/approval/approver-select-list';
import type { ApprovalUser } from '@/platform/services/model/approval';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Structural stub: Radix consumes `type` via context (not a DOM attribute).
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, type, className, ...props }: React.ComponentProps<'div'> & { type?: string }) => (
    // `type` is not a <div> prop — spread it so the stub still exposes it as a DOM attribute.
    <div data-slot="scroll-area" className={className} {...props} {...{ type }}>
      <div data-slot="scroll-area-viewport">{children}</div>
    </div>
  ),
  ScrollBar: () => null,
}));

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });

const approvers: ApprovalUser[] = [
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
];

describe('ApproverSelectList', () => {
  it('leaves all radios unchecked when selectedUserId is null', () => {
    render(
      <ApproverSelectList
        approvers={approvers}
        selectedUserId={null}
        onSelect={jest.fn()}
        testIdPrefix="approval-approver"
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).not.toBeChecked();
    }
  });

  it('places test ids on the whole-row click host and calls onSelect when clicked', () => {
    const onSelect = jest.fn();

    render(
      <ApproverSelectList
        approvers={approvers}
        selectedUserId={null}
        onSelect={onSelect}
        testIdPrefix="approval-approver"
      />,
    );

    const rowHost = screen.getByTestId('approval-approver-approver-1');
    expect(rowHost).toBeInTheDocument();
    expect(screen.getByTestId('approval-approver-approver-2')).toBeInTheDocument();

    fireEvent.click(rowHost);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('approver-1');
  });

  it('checks only the selected approver radio', () => {
    render(
      <ApproverSelectList
        approvers={approvers}
        selectedUserId="approver-2"
        onSelect={jest.fn()}
        testIdPrefix="quote-approval-approver"
      />,
    );

    expect(screen.getByRole('radio', { name: /Zoe Mitchell/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Ada Lovelace/i })).not.toBeChecked();
  });

  it('uses ScrollArea type="auto" with Viewport max-h composition on Root className', () => {
    const { container } = render(
      <ApproverSelectList
        approvers={approvers}
        selectedUserId={null}
        onSelect={jest.fn()}
        testIdPrefix="approval-approver"
      />,
    );

    const scrollRoot = container.querySelector('[data-slot="scroll-area"]');
    expect(scrollRoot).toBeInTheDocument();
    expect(scrollRoot).toHaveAttribute('type', 'auto');

    const className = scrollRoot?.getAttribute('class') ?? '';
    expect(className).toContain('scroll-area-viewport');
    expect(className).toContain('max-h-[200px]');
  });
});
