/**
 * Acceptance contract for the `article-product-link` client island.
 *
 * The island wraps a "View Product" link in the article's linked-products
 * grid. It lives in a separate file because `Link` from
 * `@/i18n/navigation` is a client export, and the island is the only
 * `'use client'` marker on its consumer path (the parent `Article` is a
 * Server Component).
 *
 * The module does not exist yet — these tests are red until the migration
 * lands.
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ArticleProductLink from './article-product-link';

describe('ArticleProductLink — client island', () => {
  it('renders a link to /product/<productId> when the id is set', () => {
    const { getByRole } = render(<ArticleProductLink productId="p-001" />);

    const link = getByRole('link');
    expect(link.getAttribute('href')).toContain('/product/p-001');
  });

  it('renders nothing when the productId is missing (legacy fallback)', () => {
    const { container } = render(<ArticleProductLink />);

    expect(container.firstChild).toBeNull();
  });

  it('exposes a non-empty accessible name (reachable via getByRole("link", { name }))', () => {
    const { getByRole } = render(<ArticleProductLink productId="p-001" />);

    // Legacy copy was "View Product"; the assertion is regex-based so the
    // implementation can adjust copy without breaking the contract.
    expect(getByRole('link', { name: /view product/i })).toBeInTheDocument();
  });
});
