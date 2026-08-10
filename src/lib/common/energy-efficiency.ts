/**
 * EU-style energy efficiency class tokens (A+++ … G).
 * Used to decide when a key-spec value should render as the Figma Energy badge.
 */
const ENERGY_EFFICIENCY_CLASS_PATTERN = /^[A-G]\+{0,3}$/i;

export function isEnergyEfficiencyClass(value: string): boolean {
  return ENERGY_EFFICIENCY_CLASS_PATTERN.test(value.trim());
}
