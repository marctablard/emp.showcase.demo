export const CustomerRole = {
  CUSTOMER: 'CUSTOMER',
  B2B: 'B2B',
  B2C: 'B2C',
  B2B_ADMIN: 'B2B_ADMIN',
  B2B_BUYER: 'B2B_BUYER',
  B2B_REQUESTER: 'B2B_REQUESTER',
} as const;

export type CustomerRoleValue = (typeof CustomerRole)[keyof typeof CustomerRole];
