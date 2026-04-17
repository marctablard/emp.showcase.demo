export const EMPORIX_LOCATION_TYPE = {
  HEADQUARTER: 'HEADQUARTER',
  WAREHOUSE: 'WAREHOUSE',
  OFFICE: 'OFFICE',
} as const;

export type EmporixLocationKind = (typeof EMPORIX_LOCATION_TYPE)[keyof typeof EMPORIX_LOCATION_TYPE];
