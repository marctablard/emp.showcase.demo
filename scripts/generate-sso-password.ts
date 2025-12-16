#!/usr/bin/env ts-node
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Generate SSO password using the same logic as EmporixAuthService
 * @param username The user's email/username
 * @returns The generated password hash
 */
function generateSsoPassword(username: string): string {
  const secret = process.env.NEXT_SSO_PASSWORD_SECRET;

  if (!secret) {
    throw new Error('NEXT_SSO_PASSWORD_SECRET environment variable is not configured');
  }

  const combined = secret + username;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  return hash;
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Error: Email parameter is required');
  console.log('\nUsage: npm run generate:sso-password <email>');
  console.log('Example: npm run generate:sso-password user@example.com');
  process.exit(1);
}

try {
  const password = generateSsoPassword(email);
  console.log('\n✅ SSO Password generated successfully!\n');
  console.log('Email:    ', email);
  console.log('Password: ', password);
  console.log('\nYou can use this password to create an SSO customer manually.');
} catch (error) {
  console.error('\n❌ Error generating SSO password:');
  console.error((error as Error).message);
  process.exit(1);
}
