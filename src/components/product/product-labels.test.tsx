/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ProductLabel } from '@/platform/services/model/product';
import { ProductLabels } from './product-labels';

const labels: ProductLabel[] = [
  {
    id: 'promo',
    name: 'Promotion',
    image: 'https://res.cloudinary.com/saas-ag/image/upload/v1/showcase/media/promo',
  },
  {
    id: 'new',
    name: 'New',
  },
];

describe('ProductLabels', () => {
  it('renders an icon with accessible name when image URL is present', () => {
    render(<ProductLabels labels={[labels[0]]} />);

    expect(screen.getByTestId('product-label-icon-promo')).toHaveAttribute('aria-label', 'Promotion');
    expect(screen.getByRole('img', { name: 'Promotion' })).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/saas-ag/image/upload/v1/showcase/media/promo',
    );
    expect(screen.queryByTestId('product-label-text-promo')).not.toBeInTheDocument();
  });

  it('falls back to a text badge when no usable image URL exists', () => {
    render(<ProductLabels labels={[labels[1]]} />);

    expect(screen.getByTestId('product-label-text-new')).toHaveTextContent('New');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('returns null for an empty labels list', () => {
    const { container } = render(<ProductLabels labels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
