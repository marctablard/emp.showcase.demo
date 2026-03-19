import type { NextAuthConfig } from 'next-auth';
import { Provider } from 'next-auth/providers';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers: Provider[] = [
  CredentialsProvider({
    name: 'Emporix Credentials',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
  }),
];

export interface ProviderOption {
  id: string;
  name: string;
  style?: {
    brandColor?: string;
    textColor?: string;
    logo?: string;
  };
}

export const providerOptions: ProviderOption[] = providers
  .map((provider) => {
    const providerData: any = typeof provider === 'function' ? provider() : provider;
    const result: ProviderOption = { id: providerData.id, name: providerData.name };
    if (providerData.style) {
      result.style = {
        brandColor: providerData.style.brandColor || providerData.style.bg,
        textColor: providerData.style.text,
        logo: providerData.style.logo,
      };
    }
    return result;
  })
  .filter((provider) => provider.id !== 'credentials');

export const config = {
  debug: false,
  trustHost: true,
  theme: { logo: 'https://authjs.dev/img/logo-sm.png' },
  providers,
  pages: {
    signOut: '/',
    signIn: '/account',
    error: '/account',
  },
} satisfies NextAuthConfig;
