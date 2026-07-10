/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import { SideBar } from './side-bar';

// Mock components
jest.mock('@/components/ui/link', () => {
  return {
    __esModule: true,
    default: function MockUiLink({ children, href }: any) {
      return <a href={href}>{children}</a>;
    },
  };
});

jest.mock('@/components/ui/h', () => {
  return {
    Heading: function MockHeading({ children }: any) {
      return <div>{children}</div>;
    },
  };
});

describe('SideBar', () => {
  it('renders without categories', () => {
    render(<SideBar categories={[]} query="test" />);
    expect(screen.queryByText('Categories')).not.toBeInTheDocument();
  });

  it('renders categories with correct href and highlight', () => {
    const categories = [
      {
        name: 'Electrical supplies > Power generation > Solar panels',
        highlighted: 'Electrical supplies > Power generation > <mark>Solar</mark> panels',
        count: 25,
      },
    ];

    render(<SideBar categories={categories} query="solar" />);

    expect(screen.getByText('Categories')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Electrical supplies > Power generation > Solar panels/ });

    // Check href format
    const expectedParams = new URLSearchParams();
    expectedParams.set(
      `filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`,
      'Electrical supplies > Power generation > Solar panels',
    );
    expectedParams.set('q', 'solar');

    expect(link).toHaveAttribute('href', `/browse?${expectedParams.toString()}`);

    // Check highlighted text
    const markEl = screen.getByText('Solar');
    expect(markEl).toHaveClass('font-bold');

    // Check that the output content from MarkedText is wrapped in a single <span>
    // so they are treated as a single text block by inline-flex containers
    expect(markEl.parentElement).toBeInstanceOf(HTMLSpanElement);
    expect(markEl.parentElement?.parentElement).toBe(link); // <span> -> <a>

    // Test the text content inside the link element completely
    expect(link.textContent).toBe('Electrical supplies > Power generation > Solar panels');
  });

  it('renders categories without query parameter in href when query is empty', () => {
    const categories = [
      {
        name: 'Tools > Drills',
        highlighted: 'Tools > Drills',
        count: 10,
      },
    ];

    render(<SideBar categories={categories} query="" />);

    const link = screen.getByRole('link', { name: 'Tools > Drills' });

    // Check href format without 'q'
    const expectedParams = new URLSearchParams();
    expectedParams.set(`filters[${BATTERY_INCLUDED_BREADCRUMB_FILTER}]`, 'Tools > Drills');

    expect(link).toHaveAttribute('href', `/browse?${expectedParams.toString()}`);
  });
});
