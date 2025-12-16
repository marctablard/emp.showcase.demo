# API Security Configuration Guide

This document provides guidance on how to properly secure API endpoints in the Emporix Showcase application.

## Current Security Approach

The application handles authentication and authorization at the middleware.ts file.

### Security Considerations

1. **Authentication**
   - Checks if the user is authenticated or not specific routes and redirects to login if not authenticated.

2. **CSRF Protection**
   - CSRF tokens are checked for state-changing operations (POST, PUT, PATCH, DELETE).

3. **Rate Limiting**
   - Sensitive endpoints like authentication and password reset should implement rate limiting

## How to Implement API Endpoints

Next.js App Router provides a simple way to create API endpoints using route handlers. Here's how to implement them:

## Client-Side CSRF Protection

CSRF protection is automatically applied to all fetch requests through the global fetch override in `instrumentation.ts`. The implementation uses the `withCsrf` utility from `utils/csrf.ts` to add CSRF tokens to all state-changing operations.

### How CSRF Protection Works

1. The global `fetch` function is overridden in `instrumentation.ts` to automatically add CSRF tokens to all state-changing requests (POST, PUT, PATCH, DELETE)
2. The `withCsrf` utility fetches a CSRF token from `/api/csrf` endpoint if needed
3. The token is added as an `x-csrf-token` header to the request
4. The middleware validates this token against the `csrf-token` cookie for protected routes

## API Endpoint Security Considerations

Below is a categorization of API endpoints based on their security requirements:

### Public Endpoints
- `/api/products/[id]` - No authentication required
- `/api/categories/tree` - No authentication required
- `/api/csrf` - No authentication required
- `/api/session` (GET) - No authentication required

### Authenticated Endpoints
- `/api/customer/current/profile` (GET) - Requires authentication
- `/api/customer/current/addresses` (GET) - Requires authentication
- `/api/company/current` (GET) - Requires authentication
- `/api/cart` (GET) - Requires authentication

### Protected Endpoints (State-Changing)
- `/api/cart` (POST) - Requires authentication and CSRF protection
- `/api/cart/[id]/items` (POST) - Requires authentication and CSRF protection
- `/api/customer/current/profile` (PATCH) - Requires authentication and CSRF protection
- `/api/customer/current/addresses` (POST) - Requires authentication and CSRF protection
- `/api/checkout` (POST) - Requires authentication and CSRF protection

### Sensitive Endpoints (Rate-Limited)
- `/api/auth/register` - Should implement rate limiting
- `/api/auth/login` - Should implement rate limiting
- `/api/password-reset` - Should implement rate limiting
- `/api/contact` - Should implement rate limiting
