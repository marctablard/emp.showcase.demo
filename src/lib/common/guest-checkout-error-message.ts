import { extractUpstreamMessage } from '@/lib/common/extract-upstream-message';

const GUEST_CHECKOUT_PREFIX = 'Failed to guest checkout';
const LOGIN_OR_MAIL_SUFFIX = /Please log in or mail\.?$/i;

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
