import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Generates a secure random CSRF token
 * @returns A random string to be used as a CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * API endpoint to generate and set a CSRF token
 * GET /api/csrf
 */
export async function GET(_request: NextRequest) {
  const token = generateCsrfToken();

  // Create the response with the token
  const response = NextResponse.json({ token });

  // Set the token as an HTTP-only cookie
  // SameSite=lax allows the cookie to be sent with same-site navigation
  // and top-level GET requests from other sites
  response.cookies.set({
    name: 'csrf-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // 8 hour expiry
    maxAge: 8 * 60 * 60,
  });

  return response;
}
