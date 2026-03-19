export const EMPORIX_TOKEN_TYPE = {
  ANONYMOUS: 'anonymous',
  CUSTOMER: 'customer',
  SERVICE: 'service',
} as const;

export type EmporixTokenType = (typeof EMPORIX_TOKEN_TYPE)[keyof typeof EMPORIX_TOKEN_TYPE];
