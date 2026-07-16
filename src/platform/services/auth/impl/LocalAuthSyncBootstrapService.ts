import crypto from 'crypto';
import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { injectable } from '@/platform/core/di/injectable';
import type { CustomerService, CustomerUpdateDto } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Registration, Session } from '@/platform/services/model/auth/auth';
import type { AuthService } from '../AuthService';
import type {
  LocalAuthSyncBootstrapResult,
  LocalAuthSyncBootstrapServiceContract,
} from '../LocalAuthSyncBootstrapService';
import { LOCAL_AUTH_SYNC_FIXTURE } from '../localAuthSyncFixture';

@injectable('LocalAuthSyncBootstrapService', 'Singleton')
export class LocalAuthSyncBootstrapService implements LocalAuthSyncBootstrapServiceContract {
  constructor(
    @inject('AuthService') private readonly authService: AuthService,
    @inject('CustomerService') private readonly customerService: CustomerService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  async bootstrap(): Promise<LocalAuthSyncBootstrapResult> {
    await this.resetCurrentSession();

    const session = await this.loginOrProvisionFixture();
    const currentCustomer = await this.customerService.getCustomer();

    if (!currentCustomer) {
      throw new Error('Fixture customer is missing after auth bootstrap');
    }

    await this.repairFixtureProfileIfNeeded(currentCustomer);

    const latestSession = (await this.authService.getCurrentSession()) ?? session;

    if (!isAuthenticatedSessionCustomerId(latestSession.customerId)) {
      throw new Error('Auth bootstrap did not create an authenticated shopper session');
    }

    return {
      authenticated: true,
      siteCode: latestSession.siteCode,
      currency: latestSession.currency,
    };
  }

  private async resetCurrentSession(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (error) {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          fixtureKey: LOCAL_AUTH_SYNC_FIXTURE.key,
        },
        'Ignoring auth bootstrap logout failure while resetting the current request-scoped session',
      );
    }
  }

  private async loginOrProvisionFixture(): Promise<Session> {
    try {
      return await this.authService.login({ username: LOCAL_AUTH_SYNC_FIXTURE.email });
    } catch (loginError) {
      this.logger.info(
        {
          error: loginError instanceof Error ? loginError.message : String(loginError),
          fixtureKey: LOCAL_AUTH_SYNC_FIXTURE.key,
        },
        'Fixture login failed; attempting lazy provisioning for auth-site-sync bootstrap',
      );
    }

    const registration: Registration = {
      credentials: {
        username: LOCAL_AUTH_SYNC_FIXTURE.email,
        password: this.deriveFixturePassword(),
      },
      customer: {
        email: LOCAL_AUTH_SYNC_FIXTURE.email,
        firstName: LOCAL_AUTH_SYNC_FIXTURE.customer.firstName,
        lastName: LOCAL_AUTH_SYNC_FIXTURE.customer.lastName,
      },
    };

    return await this.authService.register(registration);
  }

  private async repairFixtureProfileIfNeeded(currentCustomer: {
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    const profilePatch: CustomerUpdateDto = {};

    if (currentCustomer.firstName !== LOCAL_AUTH_SYNC_FIXTURE.customer.firstName) {
      profilePatch.firstName = LOCAL_AUTH_SYNC_FIXTURE.customer.firstName;
    }
    if (currentCustomer.lastName !== LOCAL_AUTH_SYNC_FIXTURE.customer.lastName) {
      profilePatch.lastName = LOCAL_AUTH_SYNC_FIXTURE.customer.lastName;
    }

    if (Object.keys(profilePatch).length === 0) {
      return;
    }

    await this.customerService.updateCustomerProfile(profilePatch);
  }

  private deriveFixturePassword(): string {
    const secret = process.env.NEXT_SSO_PASSWORD_SECRET;

    if (!secret) {
      throw new Error('NEXT_SSO_PASSWORD_SECRET environment variable is not configured');
    }

    return crypto
      .createHash('sha256')
      .update(secret + LOCAL_AUTH_SYNC_FIXTURE.email)
      .digest('hex');
  }
}

export default LocalAuthSyncBootstrapService;
