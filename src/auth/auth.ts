import NextAuth from 'next-auth';
import type { User } from 'next-auth';
import 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { headers } from 'next/headers';
import { getBaseUrlFromHeaders } from '@/lib/server/url-utils';
import server from '@/platform/server';
import type { CustomerNamingService } from '@/platform/services/customer/CustomerNamingService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { AuthService } from '../platform/services/auth/AuthService';
import { config } from './auth.config';

const enrichedProviders = config.providers.map((provider) => {
  if (provider.name === 'Credentials') {
    return CredentialsProvider({
      ...provider.options,
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        // Get the AuthService from the container
        const authService = server.get<AuthService>('AuthService');

        // Call the login method with the provided credentials
        const session = await authService.login({
          username: credentials.username as string,
          password: credentials.password as string,
        });
        if (!session) {
          return null;
        }

        try {
          const customerService = server.get<CustomerService>('CustomerService');
          const customer = await customerService.getCustomer();
          if (!session || !session.customerId || !customer) {
            return null;
          }

          // Return a session object that NextAuth can use
          const customerNamingService = server.get<CustomerNamingService>('CustomerNamingService');
          return {
            id: session.customerId,
            name: customerNamingService.getFullName(customer),
            email: customer.email,
            businessModel: customer.businessModel,
            cartMergeStatus: session.cartMergeStatus,
            cartMergeReason: session.cartMergeReason,
            roles: [], // Add Roles here, if you like to customize the UX
          };
        } catch (_error) {
          throw new Error('Failed to authorize using Credentials');
        }
      },
    });
  } else {
    return provider;
  }
});
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...config,
  providers: enrichedProviders,
  events: {
    async signOut(_message) {
      const authService = server.get<AuthService>('AuthService');
      await authService.logout();
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // If the user is signing in with credentials, return true, because the password is already validated
      if (account?.provider == 'credentials') {
        return true;
      }
      // If the user is signing in with SSO we need the email to login
      if (user.email) {
        try {
          const authService = server.get<AuthService>('AuthService');
          const session = await authService.login({ username: user.email });
          if (!session) {
            return false;
          }
          // This can be customized to include the customers SSO-User-Id in the Customer Backend and check against that
          return !!session.customerId;
        } catch (error) {
          server.get<LoggerService>('LoggerService').error({ err: error }, 'signIn error');
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      if (!user) {
        // Must fail silently when no CustomerSession is present, using SSR-Scope
        const authService = server.get<AuthService>('AuthService');
        const session = await authService.getCurrentSession();
        if (!session || session.customerId != token.user?.id) {
          return null;
        }
        return token;
      }
      return { ...token, user };
    },
    session({ session, token }) {
      if (!token) {
        return session;
      }
      return { ...session, user: token.user };
    },
    async redirect({ url, baseUrl }) {
      const actualBaseUrl = getBaseUrlFromHeaders(await headers(), baseUrl);
      if (url.startsWith('/')) {
        return `${actualBaseUrl}${url}`;
      }

      if (url.startsWith(actualBaseUrl)) {
        return url;
      }
      return actualBaseUrl;
    },
  },
});

declare module 'next-auth/jwt' {
  interface JWT {
    user?: User;
  }
}

declare module 'next-auth' {
  interface User {
    cartMergeStatus?: 'MERGED' | 'FALLBACK' | 'NOT_APPLICABLE';
    cartMergeReason?:
      | 'ANONYMOUS_CART_NOT_ELIGIBLE'
      | 'TARGET_CART_UNAVAILABLE'
      | 'UNSUPPORTED_CURRENCY'
      | 'CURRENCY_ALIGNMENT_FAILED'
      | 'MERGE_FAILED'
      | 'TRANSITION_FAILED';
  }
}
