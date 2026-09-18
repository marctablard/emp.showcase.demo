/**
 * Tests the comparison table against the real `buildComparisonGroups` — the previous version
 * tested a copy of the algorithm kept inside the test file, which drifted from the component.
 *
 * The rows are built from `specifications`, grouped by their `group`/`groupLabel` the same way
 * the PDP groups them, and keyed on `key` rather than on the localized label.
 */
import { render, screen, within } from '@testing-library/react';
import { COMPARISON_ROW } from '@/components/comparison/comparison-columns';
import {
  ComparisonTable,
  MISSING_ATTRIBUTE_VALUE,
  buildComparisonGroups,
} from '@/components/comparison/comparison-table';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import type { Product, ProductSpecification } from '@/platform/services/model/product';

// --- Mocks ---
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

/** Mirrors the real `l10n`: a locale miss yields `L10N_MISSING_LABEL`, not an empty string. */
const localize = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'en' in value) return String((value as Record<string, string>).en);
  return L10N_MISSING_LABEL;
};

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({ l10n: (value: unknown) => localize(value) }),
}));

// The levels are what the page's outline is built from; the components' own type styles are not
// what these cases are about.
jest.mock('@/components/ui/h', () => ({
  H2: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  H3: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 className={className}>{children}</h3>
  ),
}));

// --- Helpers ---

const TECHNICAL = 'technical';
const PRODUCT_SPECIFIC = 'productSpecific';

/** One group's specifications, in the flat shape the product mapper produces. */
function group(id: string, attributes: Array<[string, string, string]>): ProductSpecification[] {
  return attributes.map(([key, label, value]) => ({
    key,
    group: id,
    groupLabel: { en: id },
    label: { en: label },
    value: { en: value },
  }));
}

function makeProduct(id: string, specifications?: ProductSpecification[][]): Product {
  return {
    id,
    name: { en: `Product ${id}` },
    description: { en: '' },
    purchasable: true,
    specifications: specifications?.flat(),
  } as Product;
}

/** Stands in for the scroller: every column but the first is separated. */
const hasSeparator = (columnIndex: number) => columnIndex > 0;

/** Data rows only — each block also carries a hidden header row naming the product columns. */
const dataRows = (scope?: HTMLElement) =>
  (scope ? within(scope) : screen).getAllByRole('row').filter((row) => row.querySelector('[role="rowheader"]'));

const allRows = (products: Product[]) => buildComparisonGroups(products, localize).flatMap((group) => group.rows);

const rowFor = (products: Product[], label: string) => allRows(products).find((row) => row.label === label);

// --- Tests ---

describe('buildComparisonGroups', () => {
  it('builds one row per attribute with a value per product', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '0.09 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '0.13 kg']])]),
    ];

    expect(rowFor(products, 'Weight')?.values).toEqual(['0.09 kg', '0.13 kg']);
  });

  it('keeps an attribute only one product carries and shows a dash for the others', () => {
    const products = [
      makeProduct('p1', [
        group(TECHNICAL, [
          ['SAP_NTGEW', 'Weight', '0.09 kg'],
          ['CC_UNNummer', 'UN number', '1263'],
        ]),
      ]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '0.09 kg']])]),
    ];

    // The upstream table dropped attributes present in fewer than two products — for a
    // comparison that hid exactly the strongest difference.
    const unRow = rowFor(products, 'UN number');
    expect(unRow?.values).toEqual(['1263', MISSING_ATTRIBUTE_VALUE]);
    expect(unRow?.differs).toBe(true);
  });

  it('marks a row as differing only when the values are not all equal', () => {
    const products = [
      makeProduct('p1', [
        group(TECHNICAL, [
          ['AT_HoeheProdukt', 'Height', '185 mm'],
          ['CALC_MEINHST', 'Unit', 'Stück'],
        ]),
      ]),
      makeProduct('p2', [
        group(TECHNICAL, [
          ['AT_HoeheProdukt', 'Height', '208 mm'],
          ['CALC_MEINHST', 'Unit', 'Stück'],
        ]),
      ]),
    ];

    expect(rowFor(products, 'Height')?.differs).toBe(true);
    expect(rowFor(products, 'Unit')?.differs).toBe(false);
  });

  it('returns one block per attribute group, even when a later product introduces the group', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [
        group(PRODUCT_SPECIFIC, [['AT_Anwendungstemperatur', 'Temperature', '15-30 °C']]),
        group(TECHNICAL, [['AT_HoeheProdukt', 'Height', '10 mm']]),
      ]),
    ];

    // Grouped, not interleaved: both technical rows stay in the technical block.
    expect(
      buildComparisonGroups(products, localize).map((block) => [block.id, block.rows.map((row) => row.label)]),
    ).toEqual([
      [TECHNICAL, ['Weight', 'Height']],
      [PRODUCT_SPECIFIC, ['Temperature']],
    ]);
  });

  it('drops a group whose attributes are all empty, so it gets no heading', () => {
    const products = [
      makeProduct('p1', [
        group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']]),
        group(PRODUCT_SPECIFIC, [['AT_Leer', 'Empty', '']]),
      ]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    expect(buildComparisonGroups(products, localize).map((block) => block.id)).toEqual([TECHNICAL]);
  });

  it('treats a locale miss as an absent value rather than a value of "-"', () => {
    const products = [
      makeProduct('p1', [
        [
          {
            key: 'AT_Schlagworte',
            group: TECHNICAL,
            groupLabel: { en: TECHNICAL },
            label: { en: 'Keywords' },
            // German-only value: an English session cannot render it.
            value: { de: 'Autopflege' },
          },
        ],
      ]),
      makeProduct('p2', [group(TECHNICAL, [['AT_Schlagworte', 'Keywords', 'Care']])]),
    ];

    expect(rowFor(products, 'Keywords')?.values).toEqual([MISSING_ATTRIBUTE_VALUE, 'Care']);
  });

  it('appends the unit to the value where the specification carries one', () => {
    const products = [
      makeProduct('p1', [
        [
          {
            key: 'SAP_NTGEW',
            group: TECHNICAL,
            groupLabel: { en: TECHNICAL },
            label: { en: 'Weight' },
            value: { en: '0.09' },
            unit: { en: 'kg' },
          },
        ],
      ]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '0.13 kg']])]),
    ];

    expect(rowFor(products, 'Weight')?.values).toEqual(['0.09 kg', '0.13 kg']);
  });

  it('collects ungrouped specifications into a block of their own rather than dropping them', () => {
    const products = [
      makeProduct('p1', [[{ key: 'SAP_NTGEW', label: { en: 'Weight' }, value: { en: '1 kg' } }]]),
      makeProduct('p2', [[{ key: 'SAP_NTGEW', label: { en: 'Weight' }, value: { en: '2 kg' } }]]),
    ];

    const blocks = buildComparisonGroups(products, localize);
    expect(blocks.map((block) => block.id)).toEqual(['other']);
    expect(blocks[0].rows[0].values).toEqual(['1 kg', '2 kg']);
  });

  it('yields no blocks when the products carry no specifications', () => {
    expect(buildComparisonGroups([makeProduct('p1'), makeProduct('p2')], localize)).toEqual([]);
    expect(buildComparisonGroups([], localize)).toEqual([]);
  });
});

describe('ComparisonTable', () => {
  it('renders nothing for an empty product list', () => {
    const { container } = render(<ComparisonTable products={[]} labelPlacement="left" hasSeparator={hasSeparator} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the fallback message and no table when there are no attributes at all', () => {
    render(
      <ComparisonTable
        products={[makeProduct('p1'), makeProduct('p2')]}
        labelPlacement="left"
        hasSeparator={hasSeparator}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Centred on the visible width, not on the scrollable one: the latter reaches past the
    // viewport as soon as a product does not fit, which pushed the message off to the right.
    const message = screen.getByText('noAttributes');
    expect(message).toHaveClass('text-center', 'sticky', 'left-0');
    expect(message.className).toContain('--comparison-visible');
  });

  it('emphasises differing values, recedes matching ones and names the difference for screen readers', () => {
    const products = [
      makeProduct('p1', [
        group(TECHNICAL, [
          ['AT_HoeheProdukt', 'Height', '185 mm'],
          ['CALC_MEINHST', 'Unit', 'Stück'],
        ]),
      ]),
      makeProduct('p2', [
        group(TECHNICAL, [
          ['AT_HoeheProdukt', 'Height', '208 mm'],
          ['CALC_MEINHST', 'Unit', 'Stück'],
        ]),
      ]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    // Each block is its own table, labelled by the group heading it sits under.
    expect(screen.getByRole('table', { name: TECHNICAL })).toBeInTheDocument();
    expect(dataRows()).toHaveLength(2);

    const heightRow = screen.getByRole('rowheader', { name: /^Height/ }).closest('[role="row"]') as HTMLElement;
    const heightCells = within(heightRow).getAllByRole('cell');
    expect(heightCells.map((cell) => cell.textContent)).toEqual(['185 mm', '208 mm']);
    heightCells.forEach((cell) => {
      expect(cell).toHaveClass('font-bold', 'text-text-headings');
      expect(cell).toHaveAttribute('data-differs', 'true');
    });
    // Weight and colour alone must not carry the meaning.
    expect(within(heightRow).getByText('valuesDiffer', { exact: false })).toBeInTheDocument();

    const unitRow = screen.getByRole('rowheader', { name: 'Unit' }).closest('[role="row"]') as HTMLElement;
    const unitCells = within(unitRow).getAllByRole('cell');
    expect(unitCells.map((cell) => cell.textContent)).toEqual(['Stück', 'Stück']);
    unitCells.forEach((cell) => {
      expect(cell).toHaveClass('text-text-on-disabled');
      expect(cell).not.toHaveClass('font-bold');
      expect(cell).not.toHaveAttribute('data-differs');
    });
  });

  it('renders one block with its own heading per attribute group, as the PDP does', () => {
    const products = [
      makeProduct('p1', [
        group(PRODUCT_SPECIFIC, [['AT_Anwendungstemperatur', 'Temperature', '15-30 °C']]),
        group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']]),
      ]),
      makeProduct('p2', [
        group(PRODUCT_SPECIFIC, [['AT_Anwendungstemperatur', 'Temperature', '5-40 °C']]),
        group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']]),
      ]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    const blocks = screen.getAllByTestId('comparison-attribute-group');
    expect(blocks.map((block) => block.dataset.group)).toEqual([PRODUCT_SPECIFIC, TECHNICAL]);
    expect(screen.getByRole('heading', { name: PRODUCT_SPECIFIC })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: TECHNICAL })).toBeInTheDocument();
    // Each block carries only its own rows.
    expect(dataRows(blocks[0])).toHaveLength(1);
    expect(within(blocks[1]).getByRole('rowheader', { name: /^Weight/ })).toBeInTheDocument();
  });

  it('nests its headings under the section, down to the attribute label', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    expect(screen.getByRole('heading', { name: 'productAttributes', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: TECHNICAL, level: 3 })).toBeInTheDocument();
    // The label is the row's heading in the outline while the wrapper keeps the table role, so
    // both the outline and screen-reader table navigation work.
    const rowheader = screen.getByRole('rowheader', { name: /^Weight/ });
    expect(rowheader.firstElementChild?.tagName).toBe('H4');
  });

  it('lays every row out on the shared track list, so the values stay under their card', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    // The product row above uses the very same constant — that is what keeps a card and its
    // attribute values in one column.
    COMPARISON_ROW.split(' ').forEach((className) => expect(dataRows()[0]).toHaveClass(className));
  });

  it('keeps the block headings in view while the products slide past', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    // They live inside the horizontal scroller, so without this they leave with the first column.
    expect(screen.getByTestId('comparison-attributes-heading')).toHaveClass('sticky');
    // `md:px-6` keeps them in lot with the page title, whose bar widens its padding at `md`.
    expect(screen.getByTestId('comparison-attributes-heading')).toHaveClass('px-4', 'md:px-6');
    expect(screen.getByRole('rowheader', { name: /^Weight/ }).firstElementChild).toHaveClass('px-4', 'md:px-6');
    expect(screen.getByRole('heading', { name: TECHNICAL, level: 3 })).toHaveClass('sticky');
  });

  it('ties every column to its product through a hidden header row', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    const headers = screen.getAllByRole('columnheader');
    // One per product, plus the leading cell for the label column — the rowheader is column 1 in
    // both placements, so without it every product would sit one column too far left.
    expect(headers.map((h) => h.textContent)).toEqual(['attribute', 'Product p1', 'Product p2']);
    expect(headers[0].closest('[role="row"]')).toHaveClass('sr-only');
  });

  it('keeps the header row in the placement where the labels sit above the values', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="above" hasSeparator={hasSeparator} />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('speaks a missing value instead of leaving the cell sounding empty', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['AT_Farbe', 'Colour', 'blue']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    // The dash is a glyph a screen reader skips at default punctuation verbosity.
    const weightRow = screen.getByRole('rowheader', { name: /^Weight/ }).closest('[role="row"]') as HTMLElement;
    const empty = within(weightRow).getAllByRole('cell')[1];
    expect(empty.querySelector('[aria-hidden]')).toHaveTextContent('—');
    expect(within(empty).getByText('valueMissing')).toHaveClass('sr-only');
  });

  it('explains the difference marker once for the page rather than on every row', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    // Without it the absence of the marker is ambiguous — equal values, or a forgotten marker?
    expect(screen.getByText('differenceNote')).toHaveClass('sr-only');
  });

  it('keeps the label beside the values where a column of its own fits', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    const rowheader = screen.getByRole('rowheader', { name: /^Weight/ });
    // Sticky either way: the products slide past the label, which has to stay readable.
    expect(rowheader).toHaveClass('sticky', 'bg-surface-image-background');
    expect(rowheader).not.toHaveClass('col-span-full');
    // The scroller decides: only between two visible products, never at the edge.
    expect(screen.getAllByRole('cell')[0]).not.toHaveClass('border-l');
    expect(screen.getAllByRole('cell')[1]).toHaveClass('border-l');
  });

  it('moves the label onto a line of its own where there is no room beside the values', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="above" hasSeparator={hasSeparator} />);

    const rowheader = screen.getByRole('rowheader', { name: /^Weight/ });
    // A band across every column, with the text pinned inside it — as a patch the width of the
    // label it looked like a tag, and unpinned it slid out of view with the first page.
    expect(rowheader).toHaveClass('col-span-full', 'bg-surface-image-background');
    expect(rowheader).not.toHaveClass('sticky');
    expect(rowheader.firstElementChild).toHaveClass('sticky', 'left-0');
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).not.toHaveClass('border-l');
    expect(cells[1]).toHaveClass('border-l');
  });

  it('keeps the cells owned directly by their row so the ARIA table stays intact', () => {
    const products = [
      makeProduct('p1', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '1 kg']])]),
      makeProduct('p2', [group(TECHNICAL, [['SAP_NTGEW', 'Weight', '2 kg']])]),
    ];

    render(<ComparisonTable products={products} labelPlacement="left" hasSeparator={hasSeparator} />);

    const row = dataRows()[0];
    const rowheader = screen.getByRole('rowheader', { name: /^Weight/ });
    expect(rowheader.parentElement).toBe(row);
    within(row)
      .getAllByRole('cell')
      .forEach((cell) => expect(cell.parentElement).toBe(row));
  });
});
