/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmationDialog } from './confirmation-dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function baseProps() {
  return {
    open: true,
    onOpenChange: jest.fn(),
    title: 'Cancel order?',
    description: 'This cannot be undone.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Confirm',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  };
}

describe('ConfirmationDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmationDialog {...baseProps()} open={false} />);
    expect(screen.queryByText('Cancel order?')).not.toBeInTheDocument();
  });

  it('renders title, description and both actions when open', () => {
    render(<ConfirmationDialog {...baseProps()} />);
    expect(screen.getByText('Cancel order?')).toHaveAttribute('data-slot', 'dialog-title');
    expect(screen.getByText('This cannot be undone.')).toHaveAttribute('data-slot', 'dialog-description');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls onCancel (not onOpenChange) when the cancel action is clicked', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('calls onConfirm (not onOpenChange) when the confirm action is clicked', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('defaults to the outlineError confirm variant', () => {
    render(<ConfirmationDialog {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('text-text-error');
  });

  it('applies a custom confirmVariant', () => {
    render(<ConfirmationDialog {...baseProps()} confirmVariant="primary" />);
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('bg-surface-action');
  });

  it('does not disable actions by default (pending defaults to false)', () => {
    render(<ConfirmationDialog {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('disables both actions while pending', () => {
    render(<ConfirmationDialog {...baseProps()} pending />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('dismisses (onOpenChange(false)) when the built-in close button is clicked and not pending', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} />);
    const closeButton = document.querySelector('[data-slot="dialog-close"]') as HTMLElement;
    fireEvent.click(closeButton);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores dismiss attempts (built-in close button) while pending', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} pending />);
    const closeButton = document.querySelector('[data-slot="dialog-close"]') as HTMLElement;
    fireEvent.click(closeButton);
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('ignores Escape-triggered dismiss while pending', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} pending />);
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    fireEvent.keyDown(content, { key: 'Escape' });
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('forwards Escape-triggered dismiss when not pending', () => {
    const props = baseProps();
    render(<ConfirmationDialog {...props} />);
    const content = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
    fireEvent.keyDown(content, { key: 'Escape' });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders ReactNode title/description content, not just strings', () => {
    render(
      <ConfirmationDialog
        {...baseProps()}
        title={<span data-testid="rich-title">Rich title</span>}
        description={<span data-testid="rich-description">Rich description</span>}
      />,
    );
    expect(screen.getByTestId('rich-title')).toBeInTheDocument();
    expect(screen.getByTestId('rich-description')).toBeInTheDocument();
  });
});
