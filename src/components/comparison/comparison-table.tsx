'use client';

import { useLocale, useTranslations } from 'next-intl';
import { COMPARISON_ROW, COMPARISON_STICKY_LABEL } from '@/components/comparison/comparison-columns';
import { H2, H3 } from '@/components/ui/h';
import type { ComparisonLabelPlacement } from '@/hooks/comparison/useComparisonScroller';
import { useL10n } from '@/hooks/useL10n';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import { cn } from '@/lib/utils';
import type { Product, ProductSpecification } from '@/platform/services/model/product';

/** Shown in a product's column when that product does not carry the attribute. */
export const MISSING_ATTRIBUTE_VALUE = '—';

/** Group id for specifications the payload leaves ungrouped — mirrors the product mapper. */
const UNGROUPED_ID = 'other';

type Localize = (input: unknown) => string;

export interface ComparisonRow {
  /** Stable row identity: attribute group + specification key. */
  key: string;
  label: string;
  /** One entry per compared product, in the order the products were passed in. */
  values: string[];
  differs: boolean;
}

export interface ComparisonAttributeGroup {
  /** Specification group id, e.g. `technical`. */
  id: string;
  label: string;
  rows: ComparisonRow[];
}

/**
 * Reads a displayable specification value. `l10n` yields `L10N_MISSING_LABEL` when the localized
 * object holds nothing for the session locale — for a comparison that is an absent value, not a
 * value of "-".
 */
function readValue(l10n: Localize, spec: ProductSpecification): string {
  const text = l10n(spec.value).trim();
  if (text === '' || text === L10N_MISSING_LABEL) return '';

  const unit = spec.unit ? l10n(spec.unit).trim() : '';
  return unit && unit !== L10N_MISSING_LABEL ? `${text} ${unit}` : text;
}

/**
 * Builds the comparison blocks from the products' `specifications` — the same rows, and the same
 * grouping, the PDP renders, so an attribute is found in the same place in both places.
 *
 * One block per specification group, and every attribute *any* product carries becomes a row: an
 * attribute only one of them has is a difference worth seeing, so it gets a dash for the others.
 * The previous table only kept keys at least two products shared, which hid exactly those.
 */
export function buildComparisonGroups(products: Product[], l10n: Localize): ComparisonAttributeGroup[] {
  const groupOrder: string[] = [];
  const groupLabels = new Map<string, string>();
  const rowKeysByGroup = new Map<string, string[]>();
  const labels = new Map<string, string>();
  const valuesByRow = new Map<string, Map<number, string>>();

  products.forEach((product, productIndex) => {
    product.specifications?.forEach((spec) => {
      const value = readValue(l10n, spec);
      if (!value) return;

      const groupId = spec.group || UNGROUPED_ID;

      if (!rowKeysByGroup.has(groupId)) {
        rowKeysByGroup.set(groupId, []);
        groupOrder.push(groupId);
        groupLabels.set(groupId, (spec.groupLabel && l10n(spec.groupLabel)) || groupId);
      }

      // Keyed on the specification key, never on the label: the label is localized and therefore
      // not stable enough to match the same attribute across two products.
      const rowKey = `${groupId}:${spec.key}`;

      if (!valuesByRow.has(rowKey)) {
        valuesByRow.set(rowKey, new Map());
        rowKeysByGroup.get(groupId)?.push(rowKey);
        labels.set(rowKey, l10n(spec.label));
      }
      valuesByRow.get(rowKey)?.set(productIndex, value);
    });
  });

  return (
    groupOrder
      .map((groupId) => ({
        id: groupId,
        label: groupLabels.get(groupId) ?? groupId,
        rows: (rowKeysByGroup.get(groupId) ?? []).map((rowKey) => {
          const perProduct = valuesByRow.get(rowKey);
          const values = products.map((_, index) => perProduct?.get(index) ?? MISSING_ATTRIBUTE_VALUE);

          return {
            key: rowKey,
            label: labels.get(rowKey) ?? rowKey,
            values,
            differs: new Set(values).size > 1,
          };
        }),
      }))
      // A group whose every attribute was empty contributes no rows and gets no heading.
      .filter((group) => group.rows.length > 0)
  );
}

interface ComparisonTableProps {
  products: Product[];
  /** Left of the values where there is room for a column of its own, above them otherwise. */
  labelPlacement: ComparisonLabelPlacement;
  /** Which columns are preceded by a separator — see `useComparisonScroller`. */
  hasSeparator: (columnIndex: number) => boolean;
}

export function ComparisonTable({ products, labelPlacement, hasSeparator }: Readonly<ComparisonTableProps>) {
  const locale = useLocale();
  const { l10n } = useL10n(locale);
  const t = useTranslations('comparison');

  if (products.length === 0) {
    return null;
  }

  const groups = buildComparisonGroups(products, l10n);
  const labelAbove = labelPlacement === 'above';

  return (
    <div className="mt-6">
      {/* Sticky like the labels: the headings sit inside the horizontal scroller, so without it
          they would slide out of the viewport together with the first products. */}
      <div className="sticky left-0 w-max px-4 py-6 md:px-6" data-testid="comparison-attributes-heading">
        <H2 variant="h5">{t('productAttributes')}</H2>
        {/* Said once for the page instead of on every row: without it the absence of the marker is
            ambiguous — same values, or a marker that was forgotten? */}
        <p className="sr-only">{t('differenceNote')}</p>
      </div>

      {groups.length > 0 ? (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} data-testid="comparison-attribute-group" data-group={group.id}>
              {/* Same grouping the PDP shows, so an attribute is found in the same place here. */}
              <H3 variant="h6" className="sticky left-0 mb-3 w-max px-4 md:px-6">
                {group.label}
              </H3>
              {/* Only top and bottom. Side lines would either scroll out of the viewport with the
                  first column or, pinned to the scrollport, double up with a column separator. */}
              <div role="table" aria-label={group.label} className="w-full border-y border-border-primary">
                {/*
                  Without column headers no value belongs to a product: a screen reader reads
                  "185 mm, 208 mm, 197 mm" without knowing whose. Hidden visually, because the cards
                  above and the name strip already name the columns for the eye. The leading cell is
                  required in both label placements — the `rowheader` is column 1 either way, and
                  `col-span-full` is only how it looks; without it every column index shifts by one.
                */}
                <div role="row" className="sr-only">
                  <div role="columnheader">{t('attribute')}</div>
                  {products.map((product) => (
                    <div key={product.id} role="columnheader">
                      {l10n(product.name)}
                    </div>
                  ))}
                </div>
                {group.rows.map((row) => (
                  <div
                    key={row.key}
                    className={cn(
                      COMPARISON_ROW,
                      'w-full border-b border-border-primary transition-colors duration-200 last:border-b-0',
                      'hover:bg-surface-image-background',
                    )}
                    role="row"
                  >
                    {/* Roles sit on the grid children themselves: a wrapper without a role between
                        `row` and `cell` breaks the ARIA owned-element chain. */}
                    <div
                      role="rowheader"
                      className={cn(
                        // Its own area, so the labels read as the table's header column rather than
                        // competing with the values beside them.
                        'bg-surface-image-background text-sm font-bold text-text-body',
                        labelAbove
                          ? // A line of its own, spanning every column so the area is a band rather
                            // than a patch the width of the label text.
                            'col-span-full pt-3 pb-2'
                          : cn(COMPARISON_STICKY_LABEL, 'py-4'),
                      )}
                    >
                      <h4
                        // Deliberately a bare heading rather than the `H4` component: it carries
                        // the level for the outline, not the Figma heading type styles.
                        className={cn(
                          // From `md` the content container itself is wider, and the sticky bar's
                          // title moves with it — the label has to follow to stay in lot with it.
                          'px-4 md:px-6',
                          labelAbove
                            ? // Pinned inside the band: it would otherwise slide out of view
                              // together with the first page of products.
                              'sticky left-0 inline-block'
                            : // A long single-word label ("Schliessmechanismus") is wider than the
                              // narrow column and would run into the first value. Hyphenate where
                              // the language allows it, break anywhere only as a last resort.
                              'block hyphens-auto break-words',
                        )}
                      >
                        {row.label}
                        {/* Colour alone must not carry the meaning. */}
                        {row.differs && <span className="sr-only"> ({t('valuesDiffer')})</span>}
                      </h4>
                    </div>
                    {row.values.map((value, index) => (
                      <div
                        key={products[index].id}
                        role="cell"
                        data-differs={row.differs || undefined}
                        className={cn(
                          'flex min-w-0 break-words p-4 text-sm',
                          hasSeparator(index) && 'border-l border-border-primary',
                          // Differing values are emphasised, matching ones recede. With the labels
                          // on their own area the weight no longer competes with them.
                          row.differs ? 'font-bold text-text-headings' : 'text-text-on-disabled',
                        )}
                      >
                        {/* The dash is a glyph, not a word: at default punctuation verbosity a
                            screen reader skips it and the cell sounds empty. */}
                        {value === MISSING_ATTRIBUTE_VALUE ? (
                          <>
                            <span aria-hidden>{value}</span>
                            <span className="sr-only">{t('valueMissing')}</span>
                          </>
                        ) : (
                          value
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        // Centred on the visible width and pinned there: inside the scroller `text-center` would
        // centre it on the scrollable width, which reaches past the viewport as soon as a product
        // does not fit — the message then stood off to the right, out of sight.
        <p className="sticky left-0 w-[var(--comparison-visible,100%)] p-6 text-center text-text-on-disabled">
          {t('noAttributes')}
        </p>
      )}
    </div>
  );
}
