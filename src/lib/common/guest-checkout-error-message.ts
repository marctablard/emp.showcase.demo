const GUEST_CHECKOUT_PREFIX = 'Failed to guest checkout';
const LOGIN_OR_MAIL_SUFFIX = /Please log in or mail\.?$/i;
const QUOTED_MESSAGE_FIELD = /"message"\s*:\s*"((?:\\.|[^"\\])*)"/;

function tryParseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function extractJsonObject(raw: string): Record<string, unknown> | undefined {
  const parsed = tryParseJsonObject(raw.trim());
  if (parsed) {
    return parsed;
  }

  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    return undefined;
  }

  return tryParseJsonObject(raw.slice(jsonStart));
}

function extractQuotedMessageField(raw: string): string | undefined {
  const match = QUOTED_MESSAGE_FIELD.exec(raw);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(`"${match[1]}"`);
    return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : undefined;
  } catch {
    return match[1].trim() || undefined;
  }
}

function extractUpstreamMessage(raw: string): string | undefined {
  const parsed = extractJsonObject(raw);
  if (parsed) {
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }

    const fault = parsed.fault;
    if (fault && typeof fault === 'object' && !Array.isArray(fault)) {
      const faultstring = (fault as Record<string, unknown>).faultstring;
      if (typeof faultstring === 'string' && faultstring.trim()) {
        return faultstring.trim();
      }
    }
  }

  return extractQuotedMessageField(raw);
}

function cleanGuestCheckoutMessage(message: string): string {
  return message
    .replace(new RegExp(String.raw`^${GUEST_CHECKOUT_PREFIX}[:.]?\s*`, 'i'), '')
    .replace(/^Bad Request\s*/i, '')
    .trim()
    .replace(LOGIN_OR_MAIL_SUFFIX, '')
    .trim();
}

function formatGuestCheckoutNotification(message: string): string {
  const cleaned = cleanGuestCheckoutMessage(message);
  if (!cleaned) {
    return `${GUEST_CHECKOUT_PREFIX}.`;
  }

  return `${GUEST_CHECKOUT_PREFIX}. ${cleaned}`;
}

export function formatGuestCheckoutError(statusText: string, responseBody: string): string {
  const upstreamMessage = extractUpstreamMessage(responseBody);
  return formatGuestCheckoutNotification(upstreamMessage || statusText.trim() || 'Request failed');
}

export function toHumanReadableGuestCheckoutNotification(rawMessage: string): string {
  if (!/Failed to guest checkout/i.test(rawMessage)) {
    return rawMessage;
  }

  const upstreamMessage = extractUpstreamMessage(rawMessage);
  return formatGuestCheckoutNotification(upstreamMessage || rawMessage);
}
