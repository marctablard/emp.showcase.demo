import type { EmporixTaxConfiguration } from '@/platform/integrations/emporix/model/tax';
import type { EmporixTaxApi } from '@/platform/integrations/emporix/tax/EmporixTaxApi';
import EmporixTaxService from './EmporixTaxService';

const chTaxConfiguration: EmporixTaxConfiguration = {
  locationCode: 'CH',
  location: { countryCode: 'CH' },
  taxClasses: [
    { code: 'STANDARD', name: 'Standard', rate: 7.7, isDefault: true },
    { code: 'REDUCED', name: 'Reduced', rate: 3.7 },
    { code: 'ZERO', name: 'Zero', rate: 0 },
  ],
};

describe('EmporixTaxService', () => {
  let taxApi: jest.Mocked<Pick<EmporixTaxApi, 'getTaxConfiguration'>>;
  let taxService: EmporixTaxService;

  beforeEach(() => {
    taxApi = {
      getTaxConfiguration: jest.fn(),
    };
    taxService = new EmporixTaxService(taxApi as unknown as EmporixTaxApi);
  });

  it('returns the rate for a tax class code in the destination country', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(chTaxConfiguration);

    await expect(taxService.getTaxRate('CH', 'STANDARD')).resolves.toBe(7.7);
    await expect(taxService.getTaxRate('CH', 'REDUCED')).resolves.toBe(3.7);
    expect(taxApi.getTaxConfiguration).toHaveBeenCalledWith('CH');
  });

  it('returns 0 when the matching class rate is a successful zero', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(chTaxConfiguration);

    await expect(taxService.getTaxRate('CH', 'ZERO')).resolves.toBe(0);
  });

  it('returns undefined when the tax class is missing', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(chTaxConfiguration);

    await expect(taxService.getTaxRate('CH', 'MISSING')).resolves.toBeUndefined();
  });

  it('returns undefined when the country has no tax configuration', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(null);

    await expect(taxService.getTaxRate('XX', 'STANDARD')).resolves.toBeUndefined();
  });

  it('propagates Tax API failures instead of inventing a rate', async () => {
    taxApi.getTaxConfiguration.mockRejectedValue(new Error('Failed to get tax configuration: Forbidden'));

    await expect(taxService.getTaxRate('CH', 'STANDARD')).rejects.toThrow('Failed to get tax configuration: Forbidden');
  });

  it('returns mapped tax classes for the destination country', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(chTaxConfiguration);

    await expect(taxService.getTaxClasses('CH')).resolves.toEqual([
      { code: 'STANDARD', rate: 7.7 },
      { code: 'REDUCED', rate: 3.7 },
      { code: 'ZERO', rate: 0 },
    ]);
    expect(taxApi.getTaxConfiguration).toHaveBeenCalledWith('CH');
  });

  it('returns an empty list when the country has no tax configuration', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue(null);

    await expect(taxService.getTaxClasses('XX')).resolves.toEqual([]);
  });

  it('returns an empty list when taxClasses is missing', async () => {
    taxApi.getTaxConfiguration.mockResolvedValue({ locationCode: 'CH' });

    await expect(taxService.getTaxClasses('CH')).resolves.toEqual([]);
  });

  it('returns an empty list for empty or whitespace country codes without calling the API', async () => {
    await expect(taxService.getTaxClasses('')).resolves.toEqual([]);
    await expect(taxService.getTaxClasses('   ')).resolves.toEqual([]);

    expect(taxApi.getTaxConfiguration).not.toHaveBeenCalled();
  });

  it('propagates Tax API failures instead of inventing classes', async () => {
    taxApi.getTaxConfiguration.mockRejectedValue(new Error('Failed to get tax configuration: Forbidden'));

    await expect(taxService.getTaxClasses('CH')).rejects.toThrow('Failed to get tax configuration: Forbidden');
  });
});
