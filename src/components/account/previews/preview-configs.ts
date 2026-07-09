import type { BadgeVariant } from '@/components/ui/badge';

export type PreviewCategory =
  | 'invoices'
  | 'calendar'
  | 'training'
  | 'products'
  | 'paymentOptions'
  | 'contracts'
  | 'documents'
  | 'offers'
  | 'tasks'
  | 'messages'
  | 'default';

/**
 * next-intl's typed message keys reject `string`, so the keys used with `t()`
 * are declared as finite literal unions (they expand to concrete keys that
 * exist in `account/index.json`).
 */
type SidebarGroup = 'selfService' | 'orderManagement' | 'myOrganisation' | 'myAccount';
export type PreviewEyebrowKey = `sidebar.groups.${SidebarGroup}`;

export type PreviewTitleKey =
  | 'sidebar.items.invoicesPayments'
  | 'sidebar.items.serviceCalendar'
  | 'sidebar.items.trainingMaterial'
  | 'sidebar.items.productsMaintenance'
  | 'sidebar.items.paymentOptions'
  | 'sidebar.items.contractsAgreements'
  | 'sidebar.items.tasks'
  | 'previews.titles.documents'
  | 'previews.titles.offers'
  | 'previews.titles.messages'
  | 'previews.titles.default';

export type PreviewDescriptionKey = `previews.descriptions.${PreviewCategory}`;

export type PreviewStatLabel =
  | 'outstandingBalance'
  | 'paidThisQuarter'
  | 'overdueInvoices'
  | 'upcomingVisits'
  | 'openWorkOrders'
  | 'nextVisit'
  | 'availableCourses'
  | 'inProgressCount'
  | 'certificatesEarned'
  | 'registeredProducts'
  | 'underWarranty'
  | 'serviceDue'
  | 'activeMethods'
  | 'creditLimit'
  | 'availableCredit'
  | 'activeContracts'
  | 'expiringSoonCount'
  | 'annualVolume';

export type PreviewColumnLabel =
  | 'invoice'
  | 'issued'
  | 'dueDate'
  | 'amount'
  | 'status'
  | 'date'
  | 'service'
  | 'site'
  | 'technician'
  | 'title'
  | 'format'
  | 'duration'
  | 'updated'
  | 'product'
  | 'serial'
  | 'installed'
  | 'nextService'
  | 'method'
  | 'details'
  | 'holder'
  | 'expires'
  | 'contract'
  | 'type'
  | 'validFrom'
  | 'validUntil'
  | 'document'
  | 'category'
  | 'size'
  | 'offer'
  | 'discount'
  | 'task'
  | 'assignee'
  | 'subject'
  | 'from'
  | 'received'
  | 'reference';

export type PreviewStatusLabel =
  | 'paid'
  | 'open'
  | 'overdue'
  | 'confirmed'
  | 'scheduled'
  | 'new'
  | 'inProgress'
  | 'completed'
  | 'available'
  | 'active'
  | 'dueSoon'
  | 'expiringSoon'
  | 'default'
  | 'valid'
  | 'draft'
  | 'pending'
  | 'unread'
  | 'read';

export interface PreviewColumn {
  key: string;
  /** Sub-key under `account.previews.columns`. */
  labelKey: PreviewColumnLabel;
  align?: 'right';
  /** `primary` renders as a bold heading-coloured identifier; `status` renders a badge. */
  kind?: 'primary' | 'text' | 'status';
}

export interface PreviewStat {
  /** Sub-key under `account.previews.stats`. */
  labelKey: PreviewStatLabel;
  value: string;
}

export interface PreviewRow {
  id: string;
  cells: Record<string, string>;
  /** Sub-key under `account.previews.status`. */
  statusKey: PreviewStatusLabel;
  statusVariant: BadgeVariant;
}

export interface PreviewConfig {
  /** Full key under `account` for the uppercase eyebrow. */
  eyebrowKey: PreviewEyebrowKey;
  /** Full key under `account` for the page title. */
  titleKey: PreviewTitleKey;
  /** Full key under `account` for the supporting description. */
  descriptionKey: PreviewDescriptionKey;
  stats?: PreviewStat[];
  columns: PreviewColumn[];
  rows: PreviewRow[];
}

const STATUS: Record<PreviewStatusLabel, BadgeVariant> = {
  paid: 'success',
  open: 'information',
  overdue: 'destructive',
  confirmed: 'success',
  scheduled: 'secondary',
  new: 'information',
  inProgress: 'warning',
  completed: 'success',
  available: 'secondary',
  active: 'success',
  dueSoon: 'warning',
  expiringSoon: 'warning',
  default: 'information',
  valid: 'success',
  draft: 'muted',
  pending: 'warning',
  unread: 'information',
  read: 'muted',
};

function status(key: PreviewStatusLabel): { statusKey: PreviewStatusLabel; statusVariant: BadgeVariant } {
  return { statusKey: key, statusVariant: STATUS[key] ?? 'secondary' };
}

export const PREVIEW_CONFIGS: Record<PreviewCategory, PreviewConfig> = {
  invoices: {
    eyebrowKey: 'sidebar.groups.orderManagement',
    titleKey: 'sidebar.items.invoicesPayments',
    descriptionKey: 'previews.descriptions.invoices',
    stats: [
      { labelKey: 'outstandingBalance', value: '€ 42,180.00' },
      { labelKey: 'paidThisQuarter', value: '€ 128,940.00' },
      { labelKey: 'overdueInvoices', value: '2' },
    ],
    columns: [
      { key: 'invoice', labelKey: 'invoice', kind: 'primary' },
      { key: 'issued', labelKey: 'issued' },
      { key: 'dueDate', labelKey: 'dueDate' },
      { key: 'amount', labelKey: 'amount', align: 'right' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'INV-2026-00842',
        cells: { invoice: 'INV-2026-00842', issued: '02.06.2026', dueDate: '02.07.2026', amount: '€ 12,110.00' },
        ...status('open'),
      },
      {
        id: 'INV-2026-00817',
        cells: { invoice: 'INV-2026-00817', issued: '21.05.2026', dueDate: '20.06.2026', amount: '€ 3,980.50' },
        ...status('paid'),
      },
      {
        id: 'INV-2026-00795',
        cells: { invoice: 'INV-2026-00795', issued: '09.05.2026', dueDate: '08.06.2026', amount: '€ 640.00' },
        ...status('overdue'),
      },
      {
        id: 'INV-2026-00764',
        cells: { invoice: 'INV-2026-00764', issued: '28.04.2026', dueDate: '28.05.2026', amount: '€ 24,300.00' },
        ...status('paid'),
      },
      {
        id: 'INV-2026-00731',
        cells: { invoice: 'INV-2026-00731', issued: '12.04.2026', dueDate: '12.05.2026', amount: '€ 1,240.00' },
        ...status('paid'),
      },
    ],
  },
  calendar: {
    eyebrowKey: 'sidebar.groups.selfService',
    titleKey: 'sidebar.items.serviceCalendar',
    descriptionKey: 'previews.descriptions.calendar',
    stats: [
      { labelKey: 'upcomingVisits', value: '4' },
      { labelKey: 'openWorkOrders', value: '2' },
      { labelKey: 'nextVisit', value: '15.07.2026' },
    ],
    columns: [
      { key: 'date', labelKey: 'date', kind: 'primary' },
      { key: 'service', labelKey: 'service' },
      { key: 'site', labelKey: 'site' },
      { key: 'technician', labelKey: 'technician' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'v1',
        cells: {
          date: '15.07.2026 · 09:00',
          service: 'Preventive maintenance',
          site: 'Munich Plant 1',
          technician: 'A. Becker',
        },
        ...status('confirmed'),
      },
      {
        id: 'v2',
        cells: {
          date: '22.07.2026 · 13:30',
          service: 'Calibration & inspection',
          site: 'Hamburg Warehouse',
          technician: 'M. Schneider',
        },
        ...status('scheduled'),
      },
      {
        id: 'v3',
        cells: {
          date: '04.08.2026 · 08:00',
          service: 'Hydraulics service',
          site: 'Munich Plant 2',
          technician: 'J. Wagner',
        },
        ...status('scheduled'),
      },
      {
        id: 'v4',
        cells: {
          date: '19.08.2026 · 10:00',
          service: 'Annual safety audit',
          site: 'Cologne Site',
          technician: 'S. Fischer',
        },
        ...status('scheduled'),
      },
    ],
  },
  training: {
    eyebrowKey: 'sidebar.groups.selfService',
    titleKey: 'sidebar.items.trainingMaterial',
    descriptionKey: 'previews.descriptions.training',
    stats: [
      { labelKey: 'availableCourses', value: '18' },
      { labelKey: 'inProgressCount', value: '3' },
      { labelKey: 'certificatesEarned', value: '7' },
    ],
    columns: [
      { key: 'title', labelKey: 'title', kind: 'primary' },
      { key: 'format', labelKey: 'format' },
      { key: 'duration', labelKey: 'duration' },
      { key: 'updated', labelKey: 'updated' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 't1',
        cells: {
          title: 'Hydraulic Pump Series X – Operating Guide',
          format: 'PDF',
          duration: '24 pages',
          updated: '03.06.2026',
        },
        ...status('new'),
      },
      {
        id: 't2',
        cells: {
          title: 'Safe Handling of Industrial Lubricants',
          format: 'Video',
          duration: '18 min',
          updated: '21.05.2026',
        },
        ...status('inProgress'),
      },
      {
        id: 't3',
        cells: {
          title: 'Preventive Maintenance Fundamentals',
          format: 'Course',
          duration: '2 h',
          updated: '09.05.2026',
        },
        ...status('completed'),
      },
      {
        id: 't4',
        cells: { title: 'Spare Parts Catalog 2026', format: 'PDF', duration: '112 pages', updated: '28.04.2026' },
        ...status('available'),
      },
    ],
  },
  products: {
    eyebrowKey: 'sidebar.groups.myOrganisation',
    titleKey: 'sidebar.items.productsMaintenance',
    descriptionKey: 'previews.descriptions.products',
    stats: [
      { labelKey: 'registeredProducts', value: '36' },
      { labelKey: 'underWarranty', value: '29' },
      { labelKey: 'serviceDue', value: '3' },
    ],
    columns: [
      { key: 'product', labelKey: 'product', kind: 'primary' },
      { key: 'serial', labelKey: 'serial' },
      { key: 'installed', labelKey: 'installed' },
      { key: 'nextService', labelKey: 'nextService' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'p1',
        cells: {
          product: 'Industrial Pump IP-2200',
          serial: 'SN-2200-48213',
          installed: '14.02.2025',
          nextService: '14.08.2026',
        },
        ...status('active'),
      },
      {
        id: 'p2',
        cells: {
          product: 'Hydraulic Press HP-90',
          serial: 'SN-90-11907',
          installed: '02.11.2024',
          nextService: '20.07.2026',
        },
        ...status('dueSoon'),
      },
      {
        id: 'p3',
        cells: {
          product: 'Conveyor Drive CD-15',
          serial: 'SN-15-77420',
          installed: '30.06.2025',
          nextService: '30.06.2027',
        },
        ...status('active'),
      },
      {
        id: 'p4',
        cells: {
          product: 'Rotary Compressor AC-500',
          serial: 'SN-500-30188',
          installed: '18.09.2023',
          nextService: '12.06.2026',
        },
        ...status('dueSoon'),
      },
    ],
  },
  paymentOptions: {
    eyebrowKey: 'sidebar.groups.myOrganisation',
    titleKey: 'sidebar.items.paymentOptions',
    descriptionKey: 'previews.descriptions.paymentOptions',
    stats: [
      { labelKey: 'activeMethods', value: '4' },
      { labelKey: 'creditLimit', value: '€ 250,000.00' },
      { labelKey: 'availableCredit', value: '€ 207,820.00' },
    ],
    columns: [
      { key: 'method', labelKey: 'method', kind: 'primary' },
      { key: 'details', labelKey: 'details' },
      { key: 'holder', labelKey: 'holder' },
      { key: 'expires', labelKey: 'expires' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'pay1',
        cells: { method: 'Purchase on invoice', details: 'Net 30 days', holder: 'Emporix GmbH', expires: '–' },
        ...status('default'),
      },
      {
        id: 'pay2',
        cells: { method: 'Corporate credit card', details: 'Visa •••• 4471', holder: 'A. Becker', expires: '08/2027' },
        ...status('active'),
      },
      {
        id: 'pay3',
        cells: { method: 'SEPA direct debit', details: 'DE89 •••• 3000', holder: 'Emporix GmbH', expires: '–' },
        ...status('active'),
      },
      {
        id: 'pay4',
        cells: { method: 'Prepaid balance', details: '€ 12,400.00 available', holder: 'Emporix GmbH', expires: '–' },
        ...status('active'),
      },
    ],
  },
  contracts: {
    eyebrowKey: 'sidebar.groups.myOrganisation',
    titleKey: 'sidebar.items.contractsAgreements',
    descriptionKey: 'previews.descriptions.contracts',
    stats: [
      { labelKey: 'activeContracts', value: '5' },
      { labelKey: 'expiringSoonCount', value: '1' },
      { labelKey: 'annualVolume', value: '€ 1.2M' },
    ],
    columns: [
      { key: 'contract', labelKey: 'contract', kind: 'primary' },
      { key: 'type', labelKey: 'type' },
      { key: 'validFrom', labelKey: 'validFrom' },
      { key: 'validUntil', labelKey: 'validUntil' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'c1',
        cells: {
          contract: 'FRA-2025-0042',
          type: 'Framework agreement',
          validFrom: '01.01.2026',
          validUntil: '31.12.2026',
        },
        ...status('active'),
      },
      {
        id: 'c2',
        cells: {
          contract: 'SLA-2025-0117',
          type: 'Service level agreement',
          validFrom: '01.03.2026',
          validUntil: '28.02.2027',
        },
        ...status('active'),
      },
      {
        id: 'c3',
        cells: {
          contract: 'PRC-2024-0089',
          type: 'Pricing agreement',
          validFrom: '01.07.2025',
          validUntil: '30.06.2026',
        },
        ...status('expiringSoon'),
      },
      {
        id: 'c4',
        cells: {
          contract: 'NDA-2024-0033',
          type: 'Non-disclosure agreement',
          validFrom: '15.09.2024',
          validUntil: '14.09.2027',
        },
        ...status('active'),
      },
    ],
  },
  documents: {
    eyebrowKey: 'sidebar.groups.myOrganisation',
    titleKey: 'previews.titles.documents',
    descriptionKey: 'previews.descriptions.documents',
    columns: [
      { key: 'document', labelKey: 'document', kind: 'primary' },
      { key: 'category', labelKey: 'category' },
      { key: 'size', labelKey: 'size' },
      { key: 'updated', labelKey: 'updated' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'd1',
        cells: {
          document: 'General Terms & Conditions 2026',
          category: 'Legal',
          size: '340 KB',
          updated: '02.06.2026',
        },
        ...status('valid'),
      },
      {
        id: 'd2',
        cells: { document: 'Installation Manual IP-2200', category: 'Manual', size: '4.2 MB', updated: '21.05.2026' },
        ...status('valid'),
      },
      {
        id: 'd3',
        cells: { document: 'Certificate of Conformity', category: 'Compliance', size: '180 KB', updated: '09.05.2026' },
        ...status('valid'),
      },
      {
        id: 'd4',
        cells: { document: 'Warranty Policy Overview', category: 'Warranty', size: '260 KB', updated: '28.04.2026' },
        ...status('valid'),
      },
    ],
  },
  offers: {
    eyebrowKey: 'sidebar.groups.orderManagement',
    titleKey: 'previews.titles.offers',
    descriptionKey: 'previews.descriptions.offers',
    columns: [
      { key: 'offer', labelKey: 'offer', kind: 'primary' },
      { key: 'validUntil', labelKey: 'validUntil' },
      { key: 'discount', labelKey: 'discount' },
      { key: 'amount', labelKey: 'amount', align: 'right' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'o1',
        cells: {
          offer: 'Volume discount – Lubricants',
          validUntil: '31.07.2026',
          discount: '−12%',
          amount: '€ 8,400.00',
        },
        ...status('active'),
      },
      {
        id: 'o2',
        cells: { offer: 'Q3 Spare parts bundle', validUntil: '15.08.2026', discount: '−8%', amount: '€ 15,200.00' },
        ...status('active'),
      },
      {
        id: 'o3',
        cells: {
          offer: 'Maintenance contract renewal',
          validUntil: '30.06.2026',
          discount: '−5%',
          amount: '€ 22,000.00',
        },
        ...status('expiringSoon'),
      },
    ],
  },
  tasks: {
    eyebrowKey: 'sidebar.groups.selfService',
    titleKey: 'sidebar.items.tasks',
    descriptionKey: 'previews.descriptions.tasks',
    columns: [
      { key: 'task', labelKey: 'task', kind: 'primary' },
      { key: 'dueDate', labelKey: 'dueDate' },
      { key: 'assignee', labelKey: 'assignee' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'ta1',
        cells: { task: 'Approve purchase requisition PR-4471', dueDate: '11.07.2026', assignee: 'A. Becker' },
        ...status('pending'),
      },
      {
        id: 'ta2',
        cells: { task: 'Review framework agreement FRA-2025-0042', dueDate: '18.07.2026', assignee: 'M. Schneider' },
        ...status('open'),
      },
      {
        id: 'ta3',
        cells: { task: 'Confirm maintenance slot – Munich Plant 1', dueDate: '05.07.2026', assignee: 'J. Wagner' },
        ...status('completed'),
      },
    ],
  },
  messages: {
    eyebrowKey: 'sidebar.groups.selfService',
    titleKey: 'previews.titles.messages',
    descriptionKey: 'previews.descriptions.messages',
    columns: [
      { key: 'subject', labelKey: 'subject', kind: 'primary' },
      { key: 'from', labelKey: 'from' },
      { key: 'received', labelKey: 'received' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      {
        id: 'm1',
        cells: { subject: 'Your invoice INV-2026-00842 is available', from: 'Billing', received: '02.06.2026' },
        ...status('unread'),
      },
      {
        id: 'm2',
        cells: { subject: 'Maintenance visit confirmed – 15.07.2026', from: 'Service Team', received: '31.05.2026' },
        ...status('unread'),
      },
      {
        id: 'm3',
        cells: { subject: 'Quote Q-100428 approved', from: 'Approvals', received: '27.05.2026' },
        ...status('read'),
      },
      {
        id: 'm4',
        cells: { subject: 'New training material available', from: 'Academy', received: '21.05.2026' },
        ...status('read'),
      },
    ],
  },
  default: {
    eyebrowKey: 'sidebar.groups.myAccount',
    titleKey: 'previews.titles.default',
    descriptionKey: 'previews.descriptions.default',
    columns: [
      { key: 'reference', labelKey: 'reference', kind: 'primary' },
      { key: 'date', labelKey: 'date' },
      { key: 'amount', labelKey: 'amount', align: 'right' },
      { key: 'status', labelKey: 'status', kind: 'status' },
    ],
    rows: [
      { id: 'r1', cells: { reference: 'SPX-10428', date: '12.06.2026', amount: '€ 1,240.00' }, ...status('open') },
      { id: 'r2', cells: { reference: 'SPX-10427', date: '09.06.2026', amount: '€ 3,980.50' }, ...status('completed') },
      { id: 'r3', cells: { reference: 'SPX-10425', date: '02.06.2026', amount: '€ 640.00' }, ...status('completed') },
      { id: 'r4', cells: { reference: 'SPX-10419', date: '28.05.2026', amount: '€ 12,110.00' }, ...status('active') },
    ],
  },
};
