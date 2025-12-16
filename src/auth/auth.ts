import NextAuth from 'next-auth';
import { User } from 'next-auth';
import 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import server from '@/platform/server';
import { CustomerNamingService } from '@/platform/services/customer/CustomerNamingService';
import { CustomerService } from '@/platform/services/customer/CustomerService';
import ssr from '@/platform/ssr';
import { AuthService } from '../platform/services/auth/AuthService';
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
            roles: [],
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
      if (account?.provider == 'credentials') {
        return true;
      }
      if (user.email) {
        try {
          const authService = server.get<AuthService>('AuthService');
          const session = await authService.login({ username: user.email });
          if (!session) {
            return false;
          }
          return !!session.customerId;
        } catch (error) {
          console.error('signIn error', error);
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      if (!user) {
        // Must fail silently when no CustomerSession is present, using SSR-Scope
        const authService = ssr.get<AuthService>('AuthService');
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
  },
});

declare module 'next-auth/jwt' {
  interface JWT {
    user?: User;
  }
}
