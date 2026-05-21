const CXML_DTD = 'http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd';

export interface PunchOutCredential {
  domain?: string;
  identity: string;
}

export interface PunchOutSender extends PunchOutCredential {
  sharedSecret?: string;
  userAgent?: string;
}

export interface PunchOutOrderItem {
  lineNumber?: number;
  sku?: string;
  supplierPartId?: string;
  supplierPartAuxiliaryId?: string;
  description?: string;
  name?: string;
  quantity?: number;
  unitPrice: number;
  unitOfMeasure?: string;
  classificationDomain?: string;
  classificationCode?: string;
  classifications?: Array<{ domain?: string; code?: string }>;
  manufacturerName?: string;
  manufacturerPartId?: string;
  language?: string;
  currency?: string;
}

export interface BuildPunchOutOrderMessageParams {
  buyerCookie: string;
  from: PunchOutCredential;
  to: PunchOutCredential;
  sender: PunchOutSender;
  currency: string;
  items: PunchOutOrderItem[];
  total?: number | string;
  operationAllowed?: 'edit' | 'inspect' | 'create';
  payloadId?: string;
  timestamp?: string;
}

function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function newPayloadId(suffix = 'emporix.punchout'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}.${rand}@${suffix}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function money(amount: number, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) throw new Error(`Invalid money amount: ${amount}`);
  return `<Money currency="${esc(currency)}">${n.toFixed(2)}</Money>`;
}

function renderClassifications(item: PunchOutOrderItem): string {
  let entries: Array<{ domain: string; code: string }> = [];
  if (Array.isArray(item.classifications) && item.classifications.length) {
    entries = item.classifications.map((c) => ({
      domain: c.domain || 'UNSPSC',
      code: String(c.code || '').trim() || '00000000',
    }));
  } else {
    entries = [
      {
        domain: item.classificationDomain || 'UNSPSC',
        code: String(item.classificationCode || '').trim() || '00000000',
      },
    ];
  }
  return entries
    .map((c) => `        <Classification domain="${esc(c.domain)}">${esc(c.code)}</Classification>`)
    .join('\n');
}

function renderItem(item: PunchOutOrderItem, index: number, currency: string): string {
  const lineNumber = item.lineNumber || index + 1;
  const quantity = item.quantity || 1;
  const supplierPartId = esc(item.sku || item.supplierPartId || `LINE-${lineNumber}`);
  const auxId = item.supplierPartAuxiliaryId
    ? `<SupplierPartAuxiliaryID>${esc(item.supplierPartAuxiliaryId)}</SupplierPartAuxiliaryID>`
    : '';
  const desc = esc(item.description || item.name || supplierPartId);
  const uom = esc(item.unitOfMeasure || 'EA');
  const classifications = renderClassifications(item);
  const manuName = item.manufacturerName ? `<ManufacturerName>${esc(item.manufacturerName)}</ManufacturerName>` : '';
  const manuPart = item.manufacturerPartId
    ? `<ManufacturerPartID>${esc(item.manufacturerPartId)}</ManufacturerPartID>`
    : '';
  const lang = esc(item.language || 'en');
  const lineCurrency = esc(item.currency || currency);

  return `    <ItemIn quantity="${esc(quantity)}">
      <ItemID>
        <SupplierPartID>${supplierPartId}</SupplierPartID>
        ${auxId}
      </ItemID>
      <ItemDetail>
        <UnitPrice>${money(item.unitPrice, lineCurrency)}</UnitPrice>
        <Description xml:lang="${lang}">${desc}</Description>
        <UnitOfMeasure>${uom}</UnitOfMeasure>
${classifications}
        ${manuPart}
        ${manuName}
      </ItemDetail>
    </ItemIn>`;
}

export function buildPunchOutOrderMessage(params: BuildPunchOutOrderMessageParams): string {
  const {
    buyerCookie,
    from,
    to,
    sender,
    currency,
    items,
    total,
    operationAllowed = 'edit',
    payloadId = newPayloadId(),
    timestamp = nowIso(),
  } = params;

  if (!buyerCookie) throw new Error('buyerCookie is required');
  if (!from?.identity) throw new Error('from.identity is required');
  if (!to?.identity) throw new Error('to.identity is required');
  if (!sender?.identity) throw new Error('sender.identity is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('items must be a non-empty array');
  if (!currency) throw new Error('currency is required');

  const computedTotal =
    total !== undefined
      ? Number(total)
      : items.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity || 1), 0);

  const lines = items.map((it, idx) => renderItem(it, idx, currency)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "${CXML_DTD}">
<cXML payloadID="${esc(payloadId)}" timestamp="${esc(timestamp)}" xml:lang="en">
  <Header>
    <From>
      <Credential domain="${esc(from.domain || 'DUNS')}">
        <Identity>${esc(from.identity)}</Identity>
      </Credential>
    </From>
    <To>
      <Credential domain="${esc(to.domain || 'DUNS')}">
        <Identity>${esc(to.identity)}</Identity>
      </Credential>
    </To>
    <Sender>
      <Credential domain="${esc(sender.domain || 'DUNS')}">
        <Identity>${esc(sender.identity)}</Identity>
        <SharedSecret>${esc(sender.sharedSecret || '')}</SharedSecret>
      </Credential>
      <UserAgent>${esc(sender.userAgent || 'Emporix Storefront/1.0')}</UserAgent>
    </Sender>
  </Header>
  <Message>
    <PunchOutOrderMessage>
      <BuyerCookie>${esc(buyerCookie)}</BuyerCookie>
      <PunchOutOrderMessageHeader operationAllowed="${esc(operationAllowed)}">
        <Total>${money(computedTotal, currency)}</Total>
      </PunchOutOrderMessageHeader>
${lines}
    </PunchOutOrderMessage>
  </Message>
</cXML>`;
}
