export interface Device {
  id: string;
  name: {
    [locale: string]: string;
  };
  productId: string | null;
  companyId: string | null;
  serialNumber: string;
  health: string;
  createdAt?: string;
  modifiedAt?: string;
}
