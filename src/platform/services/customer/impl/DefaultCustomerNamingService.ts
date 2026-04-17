import { injectable } from '@/platform/core/di/injectable';
import type { Customer } from '../../model/customer/customer';
import type { CustomerNamingService } from '../CustomerNamingService';

@injectable('CustomerNamingService', 'Singleton')
export class DefaultCustomerNamingService implements CustomerNamingService {
  getSalutation(customer: Customer): string {
    return this.getFullName(customer);
  }
  getFullName(customer: Customer): string {
    return customer.firstName + ' ' + customer.lastName;
  }
  getShortName(customer: Customer): string {
    return customer.firstName || '';
  }
}

export default DefaultCustomerNamingService;
