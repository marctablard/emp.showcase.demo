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
