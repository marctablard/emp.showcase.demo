/**
 * Custom error class for Integrations
 */
export declare class IntegrationError extends Error {
  readonly statusCode: number;
  readonly data?: any;
  constructor(statusCode: number, message: string, data?: any);
}
