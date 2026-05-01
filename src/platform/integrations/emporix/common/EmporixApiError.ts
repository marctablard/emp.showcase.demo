export interface EmporixApiErrorDetails {
  operation: string;
  status: number;
  statusText: string;
  body?: string;
}

const MAX_ERROR_BODY_LENGTH = 1_000;

export class EmporixApiError extends Error {
  public readonly operation: string;
  public readonly status: number;
  public readonly statusText: string;
  public readonly body?: string;

  constructor(details: EmporixApiErrorDetails) {
    const statusLabel = details.statusText ? `${details.status} ${details.statusText}` : String(details.status);
    const bodyLabel = details.body ? `: ${details.body}` : '';

    super(`${details.operation} failed with upstream status ${statusLabel}${bodyLabel}`);
    this.name = 'EmporixApiError';
    this.operation = details.operation;
    this.status = details.status;
    this.statusText = details.statusText;
    this.body = details.body;
  }
}

export function isEmporixApiError(error: unknown): error is EmporixApiError {
  return error instanceof EmporixApiError || (error instanceof Error && error.name === 'EmporixApiError');
}

export async function createEmporixApiError(operation: string, response: Response): Promise<EmporixApiError> {
  const rawBody = await response.text();
  const body = rawBody.trim();

  return new EmporixApiError({
    operation,
    status: response.status,
    statusText: response.statusText,
    body: body ? body.slice(0, MAX_ERROR_BODY_LENGTH) : undefined,
  });
}
