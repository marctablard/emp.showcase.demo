import { Address } from '.';

export interface Site {
  code: string;
  name: string;
  countries: Country[];
  shipToCountries: Country[];
  defaultCurrency: Currency;
  defaultCountry: string;
  currencies: Currency[];
  languages: string[];
  regions: Region[];
  paymentModes: PaymentMode[];
  defaultLanguage: string;
  decimals: number;
  address: Address;
  includesTax: boolean;
}
