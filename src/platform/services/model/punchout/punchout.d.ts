export interface PunchoutFormData {
  Currency?: string;
  FromDUNSbuyer?: string;
  SenderDUNS?: string;
  buyercookie?: string;
  formpostframe?: string;
  formposturl?: string;
  operationAllowed?: 'edit' | 'inspect' | 'create';
  toDUNSsupplier?: string;
}

export interface PunchoutSession {
  id: string;
  name?: string;
  status?: string;
  token?: string;
  formData: PunchoutFormData;
}

export interface PunchoutOrderLine {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  classificationCode: string;
  manufacturerName?: string;
  currency: string;
  language: string;
}
