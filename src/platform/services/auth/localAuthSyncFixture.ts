import type { Customer } from '@/platform/services/model/customer/customer';

export interface LocalAuthSyncFixture {
  key: string;
  email: string;
  customer: Pick<Customer, 'firstName' | 'lastName'>;
}

export const LOCAL_AUTH_SYNC_FIXTURE: LocalAuthSyncFixture = {
  key: 'local-auth-sync',
  email: 'local.auth.sync@emporix-showcase.invalid',
  customer: {
    firstName: 'Local',
    lastName: 'Auth Sync',
  },
};
