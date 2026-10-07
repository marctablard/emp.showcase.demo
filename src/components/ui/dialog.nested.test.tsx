/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Dialog, DialogContent } from './dialog';

// DialogContent translates its close label, so it needs a translator even here.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function NestedDialogs({ onParentOpenChange }: { onParentOpenChange: (open: boolean) => void }) {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(true);

  return (
    <Dialog
      open={parentOpen}
      onOpenChange={(open) => {
        setParentOpen(open);
        onParentOpenChange(open);
      }}
    >
      <DialogContent>
        <p>Parent dialog</p>
        <Dialog open={childOpen} onOpenChange={setChildOpen}>
          <DialogContent>
            <p>Child dialog</p>
            <button type="button" onClick={() => setChildOpen(false)}>
              Pick address
            </button>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

describe('nested Dialog', () => {
  it('keeps the parent dialog open when a nested dialog closes', () => {
    const onParentOpenChange = jest.fn();
    render(<NestedDialogs onParentOpenChange={onParentOpenChange} />);

    expect(screen.getByText('Parent dialog')).toBeInTheDocument();
    expect(screen.getByText('Child dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pick address' }));

    expect(screen.getByText('Parent dialog')).toBeInTheDocument();
    expect(screen.queryByText('Child dialog')).not.toBeInTheDocument();
    expect(onParentOpenChange).not.toHaveBeenCalledWith(false);
  });
});
