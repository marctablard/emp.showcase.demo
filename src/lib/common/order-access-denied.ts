const UPSTREAM_STATUS_PATTERN = /\bupstream status (\d{3})\b/i;

type ErrorWithUpstreamStatus = Error & { upstreamStatus?: number };

export const ORDER_ACCESS_DENIED_MESSAGE = "You don't have permission to view this order.";

export function isOrderAccessDeniedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export function getUpstreamStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const upstreamStatus = (error as ErrorWithUpstreamStatus).upstreamStatus;

  if (Number.isInteger(upstreamStatus)) {
    return upstreamStatus ?? null;
  }

  const status = error.message.match(UPSTREAM_STATUS_PATTERN)?.[1];

  if (!status) {
    return null;
  }

  const parsedStatus = Number(status);

  return Number.isInteger(parsedStatus) ? parsedStatus : null;
}
