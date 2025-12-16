'use client';

export type RawServiceTicket = {
  Status: string;
  OrderID: string | null;
  OwnerID: string | null;
  TicketID: string;
  TicketName: string;
  ProductID: string | null;
  SubjectID: string | null;
  CustomerID: string | null;
  Description: { de?: string; en?: string };
  SubjectName: { de?: string; en?: string };
  CreatedAt?: string;
};

export type ServiceTicketSubject = {
  id: string;
  name: { de?: string; en?: string };
};

export async function fetchServiceTickets(): Promise<RawServiceTicket[]> {
  const response = await fetch('/api/servicetickets', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch service tickets: ${response.status}`);
  }

  const data = (await response.json()) as RawServiceTicket[];
  return Array.isArray(data) ? data : [];
}

export async function fetchServiceTicketSubjects(): Promise<ServiceTicketSubject[]> {
  const response = await fetch('/api/servicetickets/subjects', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch service ticket subjects: ${response.status}`);
  }

  const data = (await response.json()) as ServiceTicketSubject[];
  return Array.isArray(data) ? data : [];
}

export async function createServiceTicket(ticketData: {
  subjectId: string;
  descriptionEn: string;
  orderId?: string | null;
  productId?: string | null;
  customerId?: string | null;
}): Promise<any> {
  const response = await fetch('/api/servicetickets', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticketData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create service ticket: ${response.status}`);
  }

  return response.json();
}
