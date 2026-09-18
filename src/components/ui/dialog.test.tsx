/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from './dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function openDialog(props?: { showCloseButton?: boolean }) {
  return render(
    <Dialog defaultOpen>
      <DialogTrigger>Open me</DialogTrigger>
      <DialogContent showCloseButton={props?.showCloseButton}>
        <DialogHeader>
          <DialogTitle>Confirm</DialogTitle>
          <DialogDescription>Are you sure?</DialogDescription>
        </DialogHeader>
        <div>Body content</div>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe('Dialog', () => {
  it('renders the trigger', () => {
    openDialog();
    expect(screen.getByText('Open me')).toHaveAttribute('data-slot', 'dialog-trigger');
  });

  it('renders content, header, title, description, footer when open', () => {
    openDialog();

    const content = document.querySelector('[data-slot="dialog-content"]');
    expect(content).toBeInTheDocument();

    expect(screen.getByText('Confirm')).toHaveAttribute('data-slot', 'dialog-title');
    expect(screen.getByText('Are you sure?')).toHaveAttribute('data-slot', 'dialog-description');
    expect(document.querySelector('[data-slot="dialog-header"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-footer"]')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders the built-in close button with sr-only label by default', () => {
    openDialog();
    // The internal close button + the explicit DialogClose (Cancel) both exist.
    const closeButtons = document.querySelectorAll('[data-slot="dialog-close"]');
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('close')).toHaveClass('sr-only');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides the built-in close button when showCloseButton is false', () => {
    openDialog({ showCloseButton: false });
    expect(screen.queryByText('close')).not.toBeInTheDocument();
    // The explicit DialogClose (Cancel) is still present.
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onOpenChange when the close button is clicked (controlled)', () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const closeButton = document.querySelector('[data-slot="dialog-close"]') as HTMLElement;
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders a standalone DialogOverlay with merged className and children', () => {
    render(
      <Dialog open>
        <DialogOverlay className="overlay-x">
          <span>overlay-child</span>
        </DialogOverlay>
      </Dialog>,
    );
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toHaveClass('overlay-x');
    expect(screen.getByText('overlay-child')).toBeInTheDocument();
  });

  it('merges custom classNames on header, footer, title, description', () => {
    render(
      <Dialog open>
        <DialogContent className="content-x">
          <DialogHeader className="header-x">
            <DialogTitle className="title-x">T</DialogTitle>
            <DialogDescription className="desc-x">D</DialogDescription>
          </DialogHeader>
          <DialogFooter className="footer-x">F</DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('content-x');
    expect(document.querySelector('[data-slot="dialog-header"]')).toHaveClass('header-x');
    expect(document.querySelector('[data-slot="dialog-footer"]')).toHaveClass('footer-x');
    expect(screen.getByText('T')).toHaveClass('title-x');
    expect(screen.getByText('D')).toHaveClass('desc-x');
  });
});

describe('Dialog outside-click dismissal', () => {
  // Radix defers registering its outside-pointerdown listener to a `setTimeout(0)`
  // effect; wait a tick so the listener is attached before firing pointerdown.
  async function waitForOutsidePointerDownListener() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function clickOverlay() {
    const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
    fireEvent.pointerDown(overlay, { button: 0 });
    fireEvent.click(overlay, { button: 0 });
  }

  it('does not dismiss on outside click when closeOnOutsideClick is disabled (default)', async () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    await waitForOutsidePointerDownListener();
    clickOverlay();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('dismisses on outside click when closeOnOutsideClick is explicitly enabled', async () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent closeOnOutsideClick>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    await waitForOutsidePointerDownListener();
    clickOverlay();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('still forwards onPointerDownOutside/onInteractOutside to the consumer when outside-click close is disabled', async () => {
    const onOpenChange = jest.fn();
    const onPointerDownOutside = jest.fn();
    const onInteractOutside = jest.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent onPointerDownOutside={onPointerDownOutside} onInteractOutside={onInteractOutside}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    await waitForOutsidePointerDownListener();
    clickOverlay();
    expect(onPointerDownOutside).toHaveBeenCalled();
    expect(onInteractOutside).toHaveBeenCalled();
    // preventDefault was still applied internally, so the dialog itself does not dismiss.
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
