/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ProductCharacteristic } from './product-characteristic';

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="product-characteristic-tooltip">{children}</div>
  ),
}));

const LONG_VALUE = 'VeryLongCharacteristicValue';

describe('ProductCharacteristic', () => {
  it('caps the chip at max-w-30 and truncates both text rows', () => {
    render(<ProductCharacteristic value={LONG_VALUE} unit="WattHourUnit" />);

    const valueRow = screen.getAllByText(LONG_VALUE).find((el) => el.classList.contains('truncate'));
    const unitRow = screen.getByText('WattHourUnit');

    expect(valueRow).toBeDefined();
    expect(valueRow).toHaveClass('truncate', 'min-w-0');
    expect(valueRow).not.toHaveClass('break-words', 'whitespace-normal');
    expect(unitRow).toHaveClass('truncate', 'min-w-0');
    expect(unitRow).not.toHaveClass('break-words', 'whitespace-normal');
    expect(valueRow?.parentElement).toHaveClass('max-w-30', 'min-w-0', 'overflow-hidden');
    expect(valueRow?.parentElement?.tagName).toBe('BUTTON');
  });

  it('exposes the full untruncated attribute:value pair in a badge-owned tooltip', () => {
    render(<ProductCharacteristic value={LONG_VALUE} unit="nominal-power" attributeLabel="nominal" />);

    expect(screen.getByTestId('product-characteristic-tooltip')).toHaveTextContent(`nominal: ${LONG_VALUE}`);
    expect(screen.getByTestId('product-characteristic-tooltip')).not.toHaveTextContent(`nominal-power: ${LONG_VALUE}`);
  });

  it('still renders a 5-character value', () => {
    render(<ProductCharacteristic value="12345" unit="W" />);

    expect(screen.getAllByText('12345').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('product-characteristic-tooltip')).toHaveTextContent('W: 12345');
  });

  it('falls back to the value when the attribute label is empty', () => {
    render(<ProductCharacteristic value="1200W" unit="" />);

    expect(screen.getByTestId('product-characteristic-tooltip')).toHaveTextContent('1200W');
    expect(screen.getByTestId('product-characteristic-tooltip')).not.toHaveTextContent(': 1200W');
  });
});
