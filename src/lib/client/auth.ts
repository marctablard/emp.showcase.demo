'use client';

import type { Credentials, Registration, Session } from '@/platform/services/model/auth/auth';

const API_BASE_URL = '/api/auth';

/**
 * Login with username and password
 * @param credentials User credentials
 * @returns Session object if login successful
 */
export async function login(credentials: Credentials): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

/**
 * Logout the current user
 * @returns Success status
 */
export async function logout(): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/logout`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Logout failed');
  }

  return response.json();
}

/**
 * Get the current session if one exists
 * @returns Session object or null if no session exists
 */
export async function getCurrentSession(): Promise<Session | null> {
  const response = await fetch(`${API_BASE_URL}/session`, {
    method: 'GET',
  });

  if (response.status === 204) {
    return null; // No content means no session
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get session');
  }

  return response.json();
}

/**
 * Update session properties
 * @param updates Properties to update
 * @returns Updated session
 */
export async function updateSession(updates: Partial<Session>): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/session`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
    credentials: 'include', // Include cookies in the request
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update session');
  }

  return response.json();
}

/**
 * Check if user is authenticated
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getCurrentSession();
    return !!session && !!session.customerId;
  } catch (_error) {
    return false;
  }
}

/**
 * Register a new user
 * @param registrationData Registration data including credentials, customer details, and address
 * @returns Session object if registration successful
 */
export async function register(registrationData: Registration): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(registrationData),
    credentials: 'include', // Include cookies in the request
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}
