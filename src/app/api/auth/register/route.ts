import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { AuthService } from '@/platform/services/auth/AuthService';
import { Registration } from '@/platform/services/model/auth';

/**
 * POST /api/auth/register
 * Register a new customer
 */
export async function POST(request: NextRequest) {
  try {
    // Get the auth service from the global registry
    const authService = server.get<AuthService>('AuthService');

    // Get registration data from request body
    const registrationData: Registration = await request.json();

    // Validate registration data
    if (!registrationData.credentials?.username || !registrationData.credentials?.password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // Register the new customer
    const session = await authService.register(registrationData);
    if (!session) {
      return NextResponse.json({ error: 'Failed to register customer' }, { status: 401 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);

    // Determine appropriate status code based on error
    let status = 500;
    let message = 'An unexpected error occurred during registration';

    if (error instanceof Error) {
      if (
        error.message.includes('already exists') ||
        error.message.includes('already registered') ||
        error.message.includes('conflict_resource')
      ) {
        status = 409; // Conflict
        message = error.message;
      } else if (error.message.includes('validation')) {
        status = 400; // Bad Request
        message = error.message;
      }
    }

    return NextResponse.json({ error: message }, { status });
  }
}
