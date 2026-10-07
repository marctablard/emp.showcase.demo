import { Container } from 'inversify';
import type { EmporixCustomerApi } from '@/platform/integrations/emporix/customer/EmporixCustomerApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import type { EmporixCustomerAddress } from '@/platform/integrations/emporix/model/customer';
import type { EmporixSessionContextApi } from '@/platform/integrations/emporix/session/EmporixSessionContextApi';
import type { LoggerService } from '../../logger/LoggerService';
import EmporixAddressMapper from '../../model/common/impl/EmporixAddressMapper';
import type { CustomerAddress } from '../../model/customer/customer';
import EmporixCustomerService from './EmporixCustomerService';

describe('EmporixCustomerService', () => {
  let container: Container;
  let customerService: EmporixCustomerService;
  let mockCustomerApi: jest.Mocked<
    Pick<EmporixCustomerApi, 'addCustomerAddress' | 'updateCustomerAddress' | 'getCustomerAddresses'>
  >;
  let mockLoggerService: jest.Mocked<Pick<LoggerService, 'error'>>;

  const billingAddress: CustomerAddress = {
    contactName: 'Jane Doe',
    companyName: 'Acme',
    street: 'Main Street',
    streetNumber: '1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'DE',
    state: 'Berlin',
    contactPhone: '123456789',
    tags: ['BILLING'],
    source: 'customer',
    isDefault: true,
  };

  const emporixBillingAddress: EmporixCustomerAddress = {
    id: 'addr-1',
    contactName: 'Jane Doe',
    companyName: 'Acme',
    street: 'Main Street',
    streetNumber: '1',
    zipCode: '10115',
    city: 'Berlin',
    country: 'DE',
    state: 'Berlin',
    contactPhone: '123456789',
    tags: ['BILLING'],
    isDefault: true,
  };

  beforeEach(() => {
    container = new Container();
    jest.clearAllMocks();

    mockCustomerApi = {
      addCustomerAddress: jest.fn(),
      updateCustomerAddress: jest.fn(),
      getCustomerAddresses: jest.fn(),
    };

    mockLoggerService = {
      error: jest.fn(),
    };

    container
      .bind<EmporixCustomerApi>('EmporixCustomerApi')
      .toConstantValue(mockCustomerApi as unknown as EmporixCustomerApi);
    container
      .bind<EmporixSessionContextApi>('EmporixSessionContextApi')
      .toConstantValue({} as EmporixSessionContextApi);
    container.bind('EmporixAddressMapper').toConstantValue(new EmporixAddressMapper());
    container.bind<EmporixIamApi>('EmporixIamApi').toConstantValue({} as EmporixIamApi);
    container.bind<LoggerService>('LoggerService').toConstantValue(mockLoggerService as unknown as LoggerService);
    container.bind<EmporixCustomerService>('CustomerService').to(EmporixCustomerService);

    customerService = container.get<EmporixCustomerService>('CustomerService');
  });

  describe('createAddress', () => {
    it('should pass isDefault and tags when creating an address', async () => {
      mockCustomerApi.addCustomerAddress.mockResolvedValue({ id: 'addr-1' });
      mockCustomerApi.getCustomerAddresses.mockResolvedValue([emporixBillingAddress]);

      await customerService.createAddress(billingAddress);

      expect(mockCustomerApi.addCustomerAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          isDefault: true,
          tags: ['BILLING'],
        }),
      );
    });
  });

  describe('updateAddress', () => {
    it('should call updateCustomerAddress with isDefault true and unchanged tags', async () => {
      mockCustomerApi.updateCustomerAddress.mockResolvedValue(undefined);
      mockCustomerApi.getCustomerAddresses.mockResolvedValue([emporixBillingAddress]);

      const result = await customerService.updateAddress('addr-1', billingAddress);

      expect(mockCustomerApi.updateCustomerAddress).toHaveBeenCalledWith(
        'addr-1',
        expect.objectContaining({
          isDefault: true,
          tags: ['BILLING'],
        }),
      );
      expect(result.isDefault).toBe(true);
    });

    it('maps a re-GET isDefault that is not true so registration can treat it as persist failure', async () => {
      mockCustomerApi.updateCustomerAddress.mockResolvedValue(undefined);
      mockCustomerApi.getCustomerAddresses.mockResolvedValue([{ ...emporixBillingAddress, isDefault: false }]);

      const result = await customerService.updateAddress('addr-1', billingAddress);

      expect(mockCustomerApi.updateCustomerAddress).toHaveBeenCalledWith(
        'addr-1',
        expect.objectContaining({
          isDefault: true,
        }),
      );
      expect(result.isDefault).not.toBe(true);
    });
  });
});
