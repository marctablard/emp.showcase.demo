/** Emporix `taxAggregate.lines` / quote-style VAT breakdown. */
export interface TaxAggregateLine {
  name?: string;
  amount?: number;
  rate?: number;
  taxable?: number;
}

export interface TaxAggregate {
  lines: TaxAggregateLine[];
}

export function uniqueTaxRates(lines: TaxAggregateLine[] | undefined): number[] {
  const rates = new Set<number>();
  for (const line of lines ?? []) {
    if (typeof line.rate === 'number') {
      rates.add(line.rate);
    }
  }
  return [...rates];
}

/**
 * Single display rate for `VAT (rate%)`.
 * Undefined when there are no rates or more than one distinct rate (mixed STANDARD/REDUCED).
 */
export function resolveSingleTaxRate(lines: TaxAggregateLine[] | undefined): number | undefined {
  const rates = uniqueTaxRates(lines);
  return rates.length === 1 ? rates[0] : undefined;
}

/** Same rule for item-level rates (approvals / orders). */
export function resolveSingleNumericRate(rates: Array<number | undefined>): number | undefined {
  const unique = [...new Set(rates.filter((rate): rate is number => typeof rate === 'number'))];
  return unique.length === 1 ? unique[0] : undefined;
}

/**
 * Goods VAT % from line items: show only when every present rate is the same and > 0.
 * Does not consult taxAggregate (goods and shipping rates live in different places).
 * Near-equal derived rates (e.g. 19.01 vs 18.99) collapse to one 1-decimal value so 7.7 stays 7.7.
 */
export function resolveSharedPositiveTaxRate(rates: Array<number | undefined>): number | undefined {
  const present = rates.filter((rate): rate is number => typeof rate === 'number' && Number.isFinite(rate) && rate > 0);
  if (present.length === 0) {
    return undefined;
  }
  const first = present[0];
  if (present.every((rate) => rate === first)) {
    return first;
  }
  const keyed = present.map((rate) => Number.parseFloat(rate.toFixed(1)));
  return keyed.every((key) => key === keyed[0]) ? keyed[0] : undefined;
}
