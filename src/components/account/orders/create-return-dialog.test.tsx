/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReturnApiError } from '@/lib/client/returns';
import type { OrderReturnability } from '@/lib/common/returns/returnability';
import type { Order } from '@/platform/services/model/order/order';
import { CreateReturnDialog } from './create-return-dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => Object.assign((k: string) => k, { rich: (k: string) => k, has: () => true }),
  useLocale: () => 'de',
}));

const mockPush = jest.fn();
jest.mock('@/i18n/navigation', () => ({
  __esModule: true,
  useRouter: () => ({ push: mockPush }),
}));

const loggerError = jest.fn();
jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ error: (...args: unknown[]) => loggerError(...args) }),
}));

const mockNotify = jest.fn();
// The real Radix Select runs a Floating UI rAF loop while open, which keeps act() from
// settling and makes findBy* hang until the test timeout. The shared stand-in keeps the
// options in the document instead.
jest.mock('@/components/ui/select', () => jest.requireActual('../../../../jest/mocks/ui-select'));

jest.mock('@/components/ui/toast-notification', () => ({
  __esModule: true,
  ToastType: { Success: 'success', Error: 'error' },
  notify: (...args: unknown[]) => mockNotify(...args),
}));

const mockCreateReturn = jest.fn();
jest.mock('@/lib/client/returns', () => ({
  ...jest.requireActual('@/lib/client/returns'),
  createReturn: (...args: unknown[]) => mockCreateReturn(...args),
}));

// The item selector's own rendering (product cards, images, l10n) is covered by
// return-item-selector.test.tsx. Here it is replaced with a minimal stand-in that still
// forwards every callback to the REAL handlers passed down from CreateReturnDialog, so the
// dialog's own state machine (quantities, per-item reasons, remaining-quantity filtering) runs
// for real.
jest.mock('@/components/account/returns/return-item-selector', () => ({
  ReturnItemSelector: ({
    items,
    quantities,
    onUpdateQuantity,
    loading,
    remainingQuantityMap,
    reasonMode,
    itemReasons,
    onItemReasonChange,
    itemReasonDetails,
    onItemReasonDetailsChange,
    reasonOptions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }: any) => (
    <div data-testid="return-item-selector" data-reason-mode={reasonMode}>
      {items.map((item: { id: string; quantity: number }) => {
        const maxQty = remainingQuantityMap ? (remainingQuantityMap.get(item.id) ?? item.quantity) : item.quantity;
        const currentQty = quantities[item.id] || 0;
        return (
          <div key={item.id} data-testid={`ris-item-${item.id}`}>
            <span data-testid={`ris-qty-${item.id}`}>
              {item.id}:{currentQty}/{maxQty}
            </span>
            <button
              type="button"
              data-testid={`ris-inc-${item.id}`}
              disabled={loading}
              onClick={() => onUpdateQuantity(item.id, currentQty + 1, item.quantity)}
            >
              +
            </button>
            <button
              type="button"
              data-testid={`ris-dec-${item.id}`}
              disabled={loading}
              onClick={() => onUpdateQuantity(item.id, currentQty - 1, item.quantity)}
            >
              -
            </button>
            <button
              type="button"
              data-testid={`ris-over-max-${item.id}`}
              disabled={loading}
              onClick={() => onUpdateQuantity(item.id, item.quantity + 5, item.quantity)}
            >
              over-max
            </button>
            {reasonMode === 'per-item' && (
              <>
                <select
                  data-testid={`ris-reason-${item.id}`}
                  value={itemReasons[item.id] || ''}
                  onChange={(e) => onItemReasonChange(item.id, e.target.value)}
                >
                  <option value="">-</option>
                  {reasonOptions.map((code: string) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <textarea
                  data-testid={`ris-reason-details-${item.id}`}
                  value={itemReasonDetails[item.id] || ''}
                  onChange={(e) => onItemReasonDetailsChange(item.id, e.target.value)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  ),
}));

// jsdom lacks the pointer-capture / scroll APIs Radix Select relies on for the reason dropdown.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
});

// Addressed by test id, not by role: in per-item reason mode the mocked selector also renders
// native <option> elements, which carry the same implicit "option" role and would collide.
const pickGlobalReason = (code = 'DEFECTIVE') => {
  fireEvent.click(screen.getByTestId(`return-reason-${code}`));
};

const baseOrder: Order = {
  id: 'ORD-1000',
  status: 'DELIVERED',
  lastStatusChange: '2026-05-31T10:00:00.000Z',
  items: [
    { id: 'item-1', productId: 'p1', quantity: 3, name: 'Solar Panel' },
    { id: 'item-2', productId: 'p2', quantity: 2, name: 'Inverter' },
  ],
};

beforeEach(() => {
  mockPush.mockClear();
  loggerError.mockClear();
  mockNotify.mockClear();
  mockCreateReturn.mockReset();
});

describe('CreateReturnDialog', () => {
  it('renders the delivery date in the active locale, not in English', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    expect(screen.getByText('ORD-1000')).toBeInTheDocument();
    expect(screen.getByText('31.05.2026')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
  });

  it('shows "-" for the delivery date when the order has no lastStatusChange', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={{ ...baseOrder, lastStatusChange: undefined }} />);

    expect(screen.getByText('deliveryDate').nextElementSibling).toHaveTextContent('-');
  });

  it('passes every order item to the selector when no returnability is supplied', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    expect(screen.getByTestId('ris-item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('ris-item-item-2')).toBeInTheDocument();
  });

  it('filters out items with 0 remaining quantity when returnability is supplied', () => {
    const returnability: OrderReturnability = {
      hasAnyReturnableItem: true,
      orderItemSummaries: [
        { itemId: 'item-1', orderedQuantity: 3, alreadyReturned: 3, remaining: 0 },
        { itemId: 'item-2', orderedQuantity: 2, alreadyReturned: 0, remaining: 2 },
      ],
    };

    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} returnability={returnability} />);

    expect(screen.queryByTestId('ris-item-item-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('ris-item-item-2')).toBeInTheDocument();
    // remaining (2), not the ordered quantity (2 happens to match here, so also check a case where they differ)
    expect(screen.getByTestId('ris-qty-item-2')).toHaveTextContent('item-2:0/2');
  });

  it('caps the remaining max at the returnability value even when lower than the ordered quantity', () => {
    const returnability: OrderReturnability = {
      hasAnyReturnableItem: true,
      orderItemSummaries: [{ itemId: 'item-1', orderedQuantity: 3, alreadyReturned: 2, remaining: 1 }],
    };

    render(
      <CreateReturnDialog
        open
        onOpenChange={jest.fn()}
        order={{ ...baseOrder, items: [baseOrder.items[0]] }}
        returnability={returnability}
      />,
    );

    expect(screen.getByTestId('ris-qty-item-1')).toHaveTextContent('item-1:0/1');
  });

  it('keeps the submit button disabled until both an item quantity and a reason are chosen', async () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    const submit = screen.getByTestId('return-submitButton');
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    expect(submit).toBeDisabled();

    pickGlobalReason();
    expect(submit).not.toBeDisabled();
  });

  it('clamps the selected quantity to the max and back down to 0, never going negative', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={{ ...baseOrder, items: [baseOrder.items[0]] }} />);

    fireEvent.click(screen.getByTestId('ris-over-max-item-1'));
    expect(screen.getByTestId('ris-qty-item-1')).toHaveTextContent('item-1:3/3');

    fireEvent.click(screen.getByTestId('ris-dec-item-1'));
    expect(screen.getByTestId('ris-qty-item-1')).toHaveTextContent('item-1:2/3');

    fireEvent.click(screen.getByTestId('ris-dec-item-1'));
    fireEvent.click(screen.getByTestId('ris-dec-item-1'));
    fireEvent.click(screen.getByTestId('ris-dec-item-1'));
    expect(screen.getByTestId('ris-qty-item-1')).toHaveTextContent('item-1:0/3');
  });

  it('clears a per-item reason and its details once that item is decremented back to 0', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={{ ...baseOrder, items: [baseOrder.items[0]] }} />);

    fireEvent.click(screen.getByLabelText('provideAdditionalPerItemDetails'));
    fireEvent.click(screen.getByTestId('ris-inc-item-1'));

    fireEvent.change(screen.getByTestId('ris-reason-item-1'), { target: { value: 'DEFECTIVE' } });
    fireEvent.change(screen.getByTestId('ris-reason-details-item-1'), { target: { value: 'Broken on arrival' } });
    expect(screen.getByTestId('ris-reason-item-1')).toHaveValue('DEFECTIVE');
    expect(screen.getByTestId('ris-reason-details-item-1')).toHaveValue('Broken on arrival');

    fireEvent.click(screen.getByTestId('ris-dec-item-1'));

    expect(screen.getByTestId('ris-reason-item-1')).toHaveValue('');
    expect(screen.getByTestId('ris-reason-details-item-1')).toHaveValue('');
  });

  it('toggles reasonMode between single and per-item via the checkbox', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    expect(screen.getByTestId('return-item-selector')).toHaveAttribute('data-reason-mode', 'single');

    fireEvent.click(screen.getByLabelText('provideAdditionalPerItemDetails'));
    expect(screen.getByTestId('return-item-selector')).toHaveAttribute('data-reason-mode', 'per-item');
  });

  it('caps the description at 500 characters and updates the counter', () => {
    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    const textarea = screen.getByPlaceholderText('descriptionPlaceholder');
    const longText = 'a'.repeat(550);
    fireEvent.change(textarea, { target: { value: longText } });

    expect(textarea).toHaveValue('a'.repeat(500));
    // the Textarea primitive renders its own built-in counter alongside the dialog's own paragraph
    expect(screen.getAllByText('500/500').length).toBeGreaterThanOrEqual(1);
  });

  it('submits the selected items with the global reason and pushes to the created return', async () => {
    mockCreateReturn.mockResolvedValue({ id: 'RET-1' });
    const onOpenChange = jest.fn();

    render(<CreateReturnDialog open onOpenChange={onOpenChange} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.change(screen.getByPlaceholderText('descriptionPlaceholder'), { target: { value: '  a bit dented  ' } });

    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() => expect(mockCreateReturn).toHaveBeenCalledTimes(1));
    expect(mockCreateReturn).toHaveBeenCalledWith(
      'ORD-1000',
      [{ id: 'item-1', quantity: 2, reasonCode: undefined, reasonDetails: undefined }],
      'DEFECTIVE',
      'a bit dented',
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockPush).toHaveBeenCalledWith('/account/returns/RET-1');
  });

  it('submits per-item reasons and trims per-item details, omitting an empty/whitespace-only one', async () => {
    mockCreateReturn.mockResolvedValue({ id: 'RET-2' });

    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    fireEvent.click(screen.getByLabelText('provideAdditionalPerItemDetails'));
    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    fireEvent.click(screen.getByTestId('ris-inc-item-2'));

    fireEvent.change(screen.getByTestId('ris-reason-item-1'), { target: { value: 'DEFECTIVE' } });
    fireEvent.change(screen.getByTestId('ris-reason-details-item-1'), { target: { value: '  chipped corner  ' } });
    // item-2 gets a quantity but no reason picked -> its per-item fields must fall back to undefined
    fireEvent.change(screen.getByTestId('ris-reason-details-item-2'), { target: { value: '   ' } });

    pickGlobalReason('WRONG_ITEM');
    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() => expect(mockCreateReturn).toHaveBeenCalledTimes(1));
    const [, items] = mockCreateReturn.mock.calls[0];
    expect(items).toEqual(
      expect.arrayContaining([
        { id: 'item-1', quantity: 1, reasonCode: 'DEFECTIVE', reasonDetails: 'chipped corner' },
        { id: 'item-2', quantity: 1, reasonCode: undefined, reasonDetails: undefined },
      ]),
    );
  });

  it('shows a saving state and disables both buttons while the request is in flight', async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    mockCreateReturn.mockImplementation(() => new Promise((res) => (resolveCreate = res)));

    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() => expect(screen.getByTestId('return-submitButton')).toHaveTextContent('submitting'));
    expect(screen.getByTestId('return-submitButton')).toBeDisabled();
    expect(screen.getByTestId('return-cancelButton')).toBeDisabled();

    resolveCreate({ id: 'RET-3' });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/account/returns/RET-3'));
  });

  it('logs the English server text but shows the translated message, keeping the dialog open', async () => {
    mockCreateReturn.mockRejectedValue(new Error('order already closed'));
    const onOpenChange = jest.fn();

    render(<CreateReturnDialog open onOpenChange={onOpenChange} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'submitError', description: 'submitErrorGeneric' }),
      ),
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), orderId: 'ORD-1000' }),
      'Failed to create return',
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.getByTestId('return-submitButton')).toHaveTextContent('submit'));
  });

  it('shows a coded failure as the toast description, with a short title', async () => {
    mockCreateReturn.mockRejectedValue(
      new ReturnApiError('Item ART-4711 exceeds returnable quantity', 422, {
        code: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY',
        params: { sku: 'ART-4711', requested: 2, remaining: 1 },
      }),
    );

    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'submitError', description: 'ITEM_EXCEEDS_RETURNABLE_QUANTITY' }),
      ),
    );
  });

  it('falls back to the generic translated message when a non-Error value is thrown', async () => {
    mockCreateReturn.mockRejectedValue('network exploded');

    render(<CreateReturnDialog open onOpenChange={jest.fn()} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.click(screen.getByTestId('return-submitButton'));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'submitError', description: 'submitErrorGeneric' }),
      ),
    );
  });

  it('resets quantities, reason and description when the dialog is cancelled, before it is next opened', async () => {
    const onOpenChange = jest.fn();
    render(<CreateReturnDialog open onOpenChange={onOpenChange} order={baseOrder} />);

    fireEvent.click(screen.getByTestId('ris-inc-item-1'));
    pickGlobalReason();
    fireEvent.change(screen.getByPlaceholderText('descriptionPlaceholder'), { target: { value: 'some notes' } });
    fireEvent.click(screen.getByLabelText('provideAdditionalPerItemDetails'));

    fireEvent.click(screen.getByTestId('return-cancelButton'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    // internal state resets even though the parent still renders the dialog open
    expect(screen.getByTestId('ris-qty-item-1')).toHaveTextContent('item-1:0/3');
    expect(screen.getByTestId('return-item-selector')).toHaveAttribute('data-reason-mode', 'single');
    expect(screen.getByPlaceholderText('descriptionPlaceholder')).toHaveValue('');
    expect(screen.getByText('selectReason')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<CreateReturnDialog open={false} onOpenChange={jest.fn()} order={baseOrder} />);

    expect(screen.queryByText('ORD-1000')).not.toBeInTheDocument();
  });
});
