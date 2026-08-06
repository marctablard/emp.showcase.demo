/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EnergyBadge } from './energy-badge';

describe('EnergyBadge', () => {
  it('renders the energy rating with an accessible label', () => {
    render(<EnergyBadge rating="A+++" />);

    expect(screen.getByRole('img', { name: 'A+++' })).toBeInTheDocument();
    expect(screen.getByText('A+++')).toBeInTheDocument();
  });
});
