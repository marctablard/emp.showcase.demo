# SSO Authentication Setup

This document explains how to configure Single Sign-On (SSO) authentication in the Emporix Showcase application using Auth.js (NextAuth) providers.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [SSO Password Generation](#sso-password-generation)
- [Customer Setup in Emporix](#customer-setup-in-emporix)
- [Adding SSO Providers](#adding-sso-providers)
- [Implementation Details](#implementation-details)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

## Overview

The Emporix Showcase supports SSO authentication through Auth.js (NextAuth), allowing users to sign in using third-party identity providers (Google, GitHub, Azure AD, etc.) while maintaining their customer data in Emporix.

### How It Works

1. User authenticates with an SSO provider (e.g., Google)
2. Auth.js validates the authentication and retrieves the user's email
3. The application generates a deterministic password based on the email and a secret
4. The generated password is used to authenticate with Emporix
5. User session is established with both Auth.js and Emporix

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# SSO Password Secret (Required for SSO)
NEXT_SSO_PASSWORD_SECRET=your-secure-random-secret-here

# NextAuth Configuration (Required)
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Example: Google OAuth Provider
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### `NEXT_SSO_PASSWORD_SECRET`

**Critical:** This secret is used to generate deterministic passwords for SSO users.

- **Must be kept secure** and never committed to version control
- **Must be consistent** across all environments for the same tenant
- **Changing this secret** will invalidate all existing SSO customer passwords

Generate a secure secret:

```bash
openssl rand -base64 32
```

## SSO Password Generation

### Algorithm

The SSO password is generated using the following algorithm:

```typescript
const combined = NEXT_SSO_PASSWORD_SECRET + email;
const password = SHA256(combined);
```

**Example:**
```
Secret: "my-secret-key"
Email:  "user@example.com"
Input:  "my-secret-keyuser@example.com"
Output: "a1b2c3d4e5f6..." (SHA-256 hash)
```

### Key Properties

- **Deterministic:** Same email always produces the same password
- **Secure:** Uses SHA-256 cryptographic hashing
- **Unique:** Different emails produce different passwords
- **Secret-dependent:** Requires knowledge of `NEXT_SSO_PASSWORD_SECRET`

### Implementation

The password generation is implemented in:
- **Service:** [`src/platform/services/auth/impl/EmporixAuthService.ts`](../src/platform/services/auth/impl/EmporixAuthService.ts) (lines 155-166)
- **Script:** [`scripts/generate-sso-password.ts`](../scripts/generate-sso-password.ts)

```typescript
private generateSsoPassword(username: string): string {
  const secret = process.env.NEXT_SSO_PASSWORD_SECRET;
  
  if (!secret) {
    throw new Error('NEXT_SSO_PASSWORD_SECRET environment variable is not configured');
  }

  const combined = secret + username;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  
  return hash;
}
```

## Customer Setup in Emporix

### Prerequisites

Before SSO users can authenticate, they must exist as customers in Emporix with the correct password.

### Manual Customer Creation

#### Step 1: Generate the SSO Password

Use the provided npm script to generate the password:

```bash
npm run generate:sso-password user@example.com
```

**Output:**
```
✅ SSO Password generated successfully!

Email:     user@example.com
Password:  a1b2c3d4e5f6789...

You can use this password to create an SSO customer manually.
```

#### Step 2: Create Customer in Emporix

Create a customer in Emporix using the Emporix Management Console or API with:

- **Email:** The user's email address (must match the SSO provider email)
- **Password:** The generated SSO password hash
- **Other fields:** firstName, lastName, etc. (optional but recommended)

**Example API Request:**

```bash
POST https://api.emporix.io/customer/{tenant}/customers
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "contactEmail": "user@example.com",
  "password": "a1b2c3d4e5f6789...",
  "firstName": "John",
  "lastName": "Doe",
  "preferredLanguage": "en",
  "preferredCurrency": "EUR",
  "businessModel": "B2C"
}
```

### Automated Customer Creation

For production environments, consider implementing automated customer provisioning:

1. **Just-in-Time (JIT) Provisioning:** Create customers automatically on first SSO login
2. **Batch Import:** Pre-create customers from your identity provider
3. **Webhook Integration:** Sync customer creation from your IdP to Emporix

## Adding SSO Providers

### Supported Providers

Auth.js supports 80+ OAuth providers. Common examples:

- Google
- GitHub
- Microsoft Azure AD
- Okta
- Auth0
- Facebook
- Twitter/X

See the [Auth.js Providers Documentation](https://authjs.dev/getting-started/providers) for the full list.

### Configuration Steps

#### 1. Install Provider Package (if needed)

Most providers are included in `next-auth`. For custom providers, install the package:

```bash
npm install next-auth
```

#### 2. Add Provider to Configuration

Edit [`src/auth/auth.config.ts`](../src/auth/auth.config.ts):

```typescript
import type { NextAuthConfig } from 'next-auth';
import { Provider } from 'next-auth/providers';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

const providers: Provider[] = [
  CredentialsProvider({
    name: 'Emporix Credentials',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  GitHubProvider({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  }),
];

export const config = {
  debug: false,
  trustHost: true,
  theme: { logo: 'https://authjs.dev/img/logo-sm.png' },
  providers,
} satisfies NextAuthConfig;
```

#### 3. Add Environment Variables

Add the provider credentials to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### 4. Configure OAuth Application

Register your application with the provider:

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

**GitHub:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

## Implementation Details

### Authentication Flow

The SSO authentication flow is implemented in [`src/auth/auth.ts`](../src/auth/auth.ts):

#### 1. Sign-In Callback (lines 65-80)

When a user signs in with an SSO provider:

```typescript
async signIn({ user, account }) {
  if (account?.provider == 'credentials') {
    return true; // Skip SSO logic for credentials
  }
  if (user.email) {
    try {
      const authService = server.get<AuthService>('AuthService');
      // Login with email only - password will be auto-generated
      const session = await authService.login({ username: user.email });
      return !!session.customerId;
    } catch (error) {
      server.get<LoggerService>('LoggerService').error({ err: error }, 'signIn error');
      return false;
    }
  }
  return false;
}
```

**Key Points:**
- Credentials provider bypasses SSO logic
- SSO providers only pass the email (no password)
- `authService.login()` generates the password automatically

#### 2. Password Generation (EmporixAuthService, line 50)

In [`src/platform/services/auth/impl/EmporixAuthService.ts`](../src/platform/services/auth/impl/EmporixAuthService.ts):

```typescript
async login(credentials: Credentials): Promise<Session> {
  // ...
  const password = credentials.password || this.generateSsoPassword(credentials.username);
  const session = await this.emporixCustomerApi.login(credentials.username, password);
  // ...
}
```

**Logic:**
- If password is provided (credentials login), use it
- If password is missing (SSO login), generate it from email

#### 3. JWT Token Management (lines 81-92)

```typescript
async jwt({ token, user }) {
  if (!user) {
    // Validate session on subsequent requests
    const authService = ssr.get<AuthService>('AuthService');
    const session = await authService.getCurrentSession();
    if (!session || session.customerId != token.user?.id) {
      return null; // Invalidate token
    }
    return token;
  }
  return { ...token, user };
}
```

**Purpose:**
- Validates Emporix session on every request
- Ensures Auth.js and Emporix sessions stay in sync
- Invalidates JWT if Emporix session expires

### Security Considerations

1. **Password Security:** SSO passwords are never exposed to users or stored in plain text
2. **Secret Protection:** `NEXT_SSO_PASSWORD_SECRET` must be kept secure
3. **Session Validation:** Every request validates both Auth.js and Emporix sessions
4. **Email Verification:** Ensure SSO providers verify email addresses

## Local Development

### Quick Setup for Testing

1. **Set the SSO secret:**
   ```bash
   echo "NEXT_SSO_PASSWORD_SECRET=$(openssl rand -base64 32)" >> .env
   ```

2. **Generate a test password:**
   ```bash
   npm run generate:sso-password test@example.com
   ```

3. **Create test customer in Emporix** using the generated password

4. **Configure a test provider** (e.g., GitHub for easy local testing):
   ```env
   GITHUB_CLIENT_ID=your-test-client-id
   GITHUB_CLIENT_SECRET=your-test-client-secret
   ```

5. **Test the login flow:**
   - Navigate to `/auth/signin`
   - Click "Sign in with GitHub"
   - Verify successful authentication

### Development Tips

- Use GitHub or Google for local testing (easiest to set up)
- Create test accounts with known emails
- Pre-generate passwords for test accounts
- Use the same `NEXT_SSO_PASSWORD_SECRET` across dev team

## Troubleshooting

### Common Issues

#### "NEXT_SSO_PASSWORD_SECRET environment variable is not configured"

**Cause:** Missing or empty `NEXT_SSO_PASSWORD_SECRET` in `.env`

**Solution:**
```bash
echo "NEXT_SSO_PASSWORD_SECRET=$(openssl rand -base64 32)" >> .env
```

#### "Failed to authorize using Credentials"

**Cause:** Customer doesn't exist in Emporix or password mismatch

**Solution:**
1. Generate the correct password: `npm run generate:sso-password user@email.com`
2. Verify customer exists in Emporix with that exact email
3. Update customer password in Emporix if needed

#### SSO Login Succeeds but Emporix Session Fails

**Cause:** Customer exists but password doesn't match generated hash

**Solution:**
1. Regenerate password: `npm run generate:sso-password user@email.com`
2. Update customer password in Emporix
3. Ensure `NEXT_SSO_PASSWORD_SECRET` hasn't changed

#### Different Passwords in Different Environments

**Cause:** Different `NEXT_SSO_PASSWORD_SECRET` values across environments

**Solution:**
- Use the **same secret** in all environments for the same tenant
- Document the secret in your secret management system
- Never change the secret without migrating all customer passwords

### Debug Mode

Enable Auth.js debug mode in [`src/auth/auth.config.ts`](../src/auth/auth.config.ts):

```typescript
export const config = {
  debug: true, // Enable detailed logging
  // ...
} satisfies NextAuthConfig;
```

Check logs for detailed authentication flow information.

## Related Documentation

- [Auth.js Documentation](https://authjs.dev/)
- [Auth.js Providers](https://authjs.dev/getting-started/providers)
- [Environment Variables](./environment-variables.md)
- [Layered Architecture](./layered-architecture.md)
- [Dependency Injection](./dependency-injection.md)

## Security Best Practices

1. **Never commit secrets** - Keep `NEXT_SSO_PASSWORD_SECRET` in secret management
2. **Use strong secrets** - Generate with `openssl rand -base64 32`
3. **Rotate carefully** - Changing the secret requires updating all customer passwords
4. **Verify emails** - Ensure SSO providers verify email ownership
5. **Monitor failed logins** - Track authentication failures
6. **Use HTTPS** - Always use HTTPS in production
7. **Implement rate limiting** - Protect against brute force attacks
8. **Audit access** - Log all authentication events
