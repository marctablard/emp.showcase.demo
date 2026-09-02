/**
 * Cart tax country lives on `countryCode` (create/PATCH) even though
 * `EmporixCart.countryCode` is marked deprecated in favor of `addresses[]`.
 * Read/write through this un-deprecated shape so tax alignment does not
 * trip typescript:S1874 on the cart DTO.
 */
export type EmporixCartTaxCountry = {
  countryCode?: string;
};

export function readCartTaxCountry(cart: EmporixCartTaxCountry): string {
  return typeof cart.countryCode === 'string' ? cart.countryCode.trim().toUpperCase() : '';
}

export function cartTaxCountryWrite(countryCode: string): EmporixCartTaxCountry {
  return { countryCode };
}
