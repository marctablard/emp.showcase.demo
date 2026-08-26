import { formatGuestCheckoutError, toHumanReadableGuestCheckoutNotification } from './guest-checkout-error-message';

const EMAIL_EXISTS_BODY = JSON.stringify({
  status: 400,
  type: 'business_error',
  message:
    'Customer with the following e-mail: `v.kaparatuser20260610-2@emporix.com` already exist. Please log in or mail.',
  moreInfo: 'https://saas-ag.com/patterns/errortypes.html',
  details: [],
});

const EXPECTED_EMAIL_EXISTS =
  'Failed to guest checkout. Customer with the following e-mail: `v.kaparatuser20260610-2@emporix.com` already exist.';

describe('guest-checkout-error-message', () => {
  it('formats an Emporix email-exists body without status JSON or login-or-mail suffix', () => {
    expect(formatGuestCheckoutError('Bad Request', EMAIL_EXISTS_BODY)).toBe(EXPECTED_EMAIL_EXISTS);
  });

  it('uses the fault string for gateway timeouts so retry detection still matches', () => {
    expect(
      formatGuestCheckoutError(
        'Gateway Timeout',
        '{"fault":{"faultstring":"Gateway Timeout","detail":{"reason":"TARGET_READ_TIMEOUT"}}}',
      ),
    ).toBe('Failed to guest checkout. Gateway Timeout');
  });

  it('falls back to status text when the body is not JSON', () => {
    expect(formatGuestCheckoutError('Service Unavailable', 'upstream exploded')).toBe(
      'Failed to guest checkout. Service Unavailable',
    );
  });

  it('rewrites a dumped guest-checkout notification into the human-readable form', () => {
    const dumped = `Failed to guest checkout: Bad Request ${EMAIL_EXISTS_BODY}`;
    expect(toHumanReadableGuestCheckoutNotification(dumped)).toBe(EXPECTED_EMAIL_EXISTS);
  });

  it('rewrites a mangled toast dump that is no longer valid JSON', () => {
    const mangled =
      'Failed to guest checkout Bad Request ("status":400 "type":"business_ error","message":"Customer with the following e-mail: `v.kaparatuser20260610-2@emporix.com` already exist. Please log in or mail."."moreinfe":"https://saas-ag.com/patterns/errortypes.html","details":[]}';
    expect(toHumanReadableGuestCheckoutNotification(mangled)).toBe(EXPECTED_EMAIL_EXISTS);
  });

  it('leaves unrelated checkout errors unchanged', () => {
    expect(toHumanReadableGuestCheckoutNotification('Failed to process checkout')).toBe('Failed to process checkout');
    expect(toHumanReadableGuestCheckoutNotification(`Failed to checkout: Bad Request ${EMAIL_EXISTS_BODY}`)).toBe(
      `Failed to checkout: Bad Request ${EMAIL_EXISTS_BODY}`,
    );
  });
});
