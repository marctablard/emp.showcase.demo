/**
 * Result of a setup operation
 */
export interface SetupResult {
  /** Whether the setup operation was successful */
  success: boolean;
  /** Optional message describing the result */
  message?: string;
  /** Optional details of the result */
  details?: any;
  /** Optional error message if the operation failed */
  error?: string;
}

/**
 * Interface for setup steps that can be registered with the SetupService
 */
export interface SetupService {
  /** Unique identifier for this setup step */
  id: string;
  /** Human-readable name of this setup step */
  name: string;
  /** Execute the setup step */
  execute(): Promise<SetupResult>;
}

/**
 * Represents a single API operation to be executed as part of a setup step
 */
export interface SetupOperation {
  /** The system/service to use for this operation (e.g., 'Emporix') */
  system: string;

  /** The endpoint to call, in format METHOD:/path/to/resource */
  endpoint: string;

  /** The payload to send with the request */
  payload?: any;

  /** Optional token to use for this operation (defaults to 'service') */
  token?: 'service' | 'session' | 'anonymous';

  /** Optional headers to include with the request */
  headers?: Record<string, string>;

  /** Optional description of this operation */
  description?: string;

  /** Optional condition to determine if this operation should be executed */
  condition?: {
    /** The endpoint to call to check the condition */
    endpoint: string;
    /** Function that evaluates the response to determine if the operation should be executed */
    evaluate: string;
  };
}
