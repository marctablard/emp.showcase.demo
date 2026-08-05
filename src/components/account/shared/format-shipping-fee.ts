/**
 * Format a shipping fee for detail cards (Order / Quote / Approval).
 * Zero cost displays as the localized "Free" label, matching Order Overview.
 */
export function formatShippingFeeDisplay(
  amount: number | undefined | null,
  formatAmount: (amount: number) => string,
  freeLabel: string,
): string {
  if (amount === undefined || amount === null || amount === 0) {
    return freeLabel;
  }
  return formatAmount(amount);
}
