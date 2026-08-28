/**
 * Shared tax-line helpers for Approval / Order / Quote / Return detail cards.
 * Prefer an explicit single model tax rate for `VAT (rate%)`; hide the row when the rate
 * is 0% or the tax amount is 0 (e.g. free shipping that still carries a non-zero statutory rate).
 */

export type DetailTaxLineInput = {
  /** Explicit tax rate from the API/model when present (e.g. 19 or 0). */
  taxRate?: number;
  /** Tax amount; when 0 the row is hidden even if taxRate is positive. */
  taxAmount?: number;
  /** Net base for deriving a display rate when taxRate is absent. */
  netAmount?: number;
};

/**
 * True when the tax row should render.
 * Hidden when taxAmount is 0, when taxRate is 0, or when neither rate nor positive amount is available.
 */
export function shouldDisplayTaxLine({ taxRate, taxAmount }: DetailTaxLineInput): boolean {
  if (typeof taxAmount === 'number' && taxAmount === 0) {
    return false;
  }
  if (typeof taxRate === 'number') {
    return taxRate > 0;
  }
  return (taxAmount ?? 0) > 0;
}

/**
 * Only an explicit single `taxRate` is shown as `VAT (rate%)`.
 * Do not derive a blended rate from tax/net — mixed taxAggregate lines would look like one rate.
 */
export function resolveDetailTaxRatePercent({ taxRate }: DetailTaxLineInput): number | undefined {
  if (typeof taxRate === 'number') {
    return Math.round(taxRate);
  }
  return undefined;
}

/** Suffix like ` (19%)` for tax labels; empty when rate is absent or not displayable. */
export function detailTaxRateSuffix(input: DetailTaxLineInput): string {
  if (!shouldDisplayTaxLine(input)) {
    return '';
  }
  const rate = resolveDetailTaxRatePercent(input);
  return typeof rate === 'number' ? ` (${rate}%)` : '';
}
