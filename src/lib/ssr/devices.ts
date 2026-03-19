'use server';

import { cache } from 'react';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import ssr from '@/platform/ssr';
import type { Device } from '@/types/device';

const getLogger = () => ssr.get<LoggerService>('LoggerService');

export const getDevices = cache(async (): Promise<Device[]> => {
  try {
    const customerService = ssr.get<CustomerService>('CustomerService');
    const currentCustomer = await customerService.getCustomer();

    if (!currentCustomer || !currentCustomer.legalEntityId) {
      return [];
    }

    const api = ssr.get<EmporixApiInvoker>('EmporixApiInvoker');
    const config = ssr.get('EmporixConfig') as { tenant: string };

    const path = `schema/${config.tenant}/custom-entities/DEVICES/instances`;
    const q = `mixins.ownership.owner.id:${currentCustomer.legalEntityId}`;
    const urlWithQuery = `${path}?q=${encodeURIComponent(q)}`;

    const res = await api.authenticatedFetch(
      urlWithQuery,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': '*',
        },
        cache: 'no-store',
      },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!res.ok) {
      getLogger().error({ status: res.status }, 'Failed to fetch devices from Emporix');
      return [];
    }

    const instances = (await res.json()) as Array<any>;

    const devices = Array.isArray(instances)
      ? instances.map((it) => {
          const ownership = it?.mixins?.ownership || {};
          return {
            id: it?.id ?? '',
            name: it?.name ?? {},
            productId: ownership.product?.id ?? null,
            companyId: ownership.owner?.id ?? null,
            serialNumber: ownership.serial ?? '',
            health: ownership.health ?? '',
            createdAt: it?.metadata?.createdAt ?? undefined,
            modifiedAt: it?.metadata?.modifiedAt ?? undefined,
          };
        })
      : [];

    return devices;
  } catch (error) {
    getLogger().error({ error: error instanceof Error ? error.message : String(error) }, 'SSR getDevices failed');
    return [];
  }
});
