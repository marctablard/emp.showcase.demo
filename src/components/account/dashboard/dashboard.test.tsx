/** @jest-environment jsdom */
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import Dashboard from './dashboard';

const mounts = jest.fn();

function Card({ label }: Readonly<{ label: string }>) {
  useEffect(() => {
    mounts(label);
  }, [label]);
  return <div>{label}</div>;
}

jest.mock('react-grid-layout/css/styles.css', () => ({}));
jest.mock('react-resizable/css/styles.css', () => ({}));
jest.mock('./cards/ai-helper-card', () => ({ AiHelperCard: () => <Card label="ai" /> }));
jest.mock('./cards/documents-card', () => ({ DocumentsCard: () => <Card label="documents" /> }));
jest.mock('./cards/my-invoices-card', () => ({ MyInvoicesCard: () => <Card label="invoices" /> }));
jest.mock('./cards/my-orders-card', () => ({ MyOrdersCard: () => <Card label="orders" /> }));
jest.mock('./cards/notification-card', () => ({ NotificationCard: () => <Card label="notification" /> }));
jest.mock('./cards/ticket-card', () => ({ TicketCard: () => <Card label="ticket" /> }));
jest.mock('./cards/weather-card', () => ({ WeatherCard: () => <Card label="weather" /> }));

const layouts = { lg: [{ i: 'weather', x: 0, y: 0, w: 1, h: 12 }] };

describe('Dashboard', () => {
  beforeEach(() => mounts.mockClear());

  it('makes every widget draggable and resizable when customize is switched on after mount', () => {
    const { container, rerender } = render(
      <Dashboard isCustomizable={false} layouts={layouts} layoutChanged={jest.fn()} />,
    );
    const items = () => Array.from(container.querySelectorAll('.react-grid-item'));

    expect(items()).toHaveLength(7);
    expect(items().some((item) => item.classList.contains('react-draggable'))).toBe(false);

    rerender(<Dashboard isCustomizable layouts={layouts} layoutChanged={jest.fn()} />);

    expect(items().every((item) => item.classList.contains('react-draggable'))).toBe(true);
    expect(items().some((item) => item.classList.contains('react-resizable-hide'))).toBe(false);
  });

  it('locks the widgets again when customize is switched off without remounting the cards', () => {
    const { container, rerender } = render(<Dashboard isCustomizable layouts={layouts} layoutChanged={jest.fn()} />);
    expect(mounts).toHaveBeenCalledTimes(7);

    rerender(<Dashboard isCustomizable={false} layouts={layouts} layoutChanged={jest.fn()} />);

    const items = Array.from(container.querySelectorAll('.react-grid-item'));
    expect(items.some((item) => item.classList.contains('react-draggable'))).toBe(false);
    expect(mounts).toHaveBeenCalledTimes(7);
  });
});
