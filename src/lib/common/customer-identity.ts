export const CUSTOMER_ID = {
  SESSION_ANONYMOUS: 'ANONYMOUS',
  PROFILE_ANONYMOUS: '00000000',
} as const;

export const isAnonymousSessionCustomerId = (customerId?: string): boolean => {
  return customerId === CUSTOMER_ID.SESSION_ANONYMOUS;
};

export const isAuthenticatedSessionCustomerId = (customerId?: string): customerId is string => {
  return Boolean(customerId) && !isAnonymousSessionCustomerId(customerId);
};

export const isAnonymousProfileCustomerId = (customerId?: string): boolean => {
  return customerId === CUSTOMER_ID.PROFILE_ANONYMOUS;
};
