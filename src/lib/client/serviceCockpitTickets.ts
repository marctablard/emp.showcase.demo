export type CreateServiceCockpitTicketPayload = {
  subject: string;
  summary: string;
  businessImpact: string;
  productId: string;
  quantity: number;
};

export async function createServiceCockpitTicket(ticketData: CreateServiceCockpitTicketPayload): Promise<unknown> {
  const response = await fetch('/api/service-cockpit-tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(ticketData),
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `Failed to create ticket: ${response.status}`;
    try {
      const errorData = (await response.json()) as { error?: string };
      if (errorData.error) {
        message = errorData.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return null;
}
