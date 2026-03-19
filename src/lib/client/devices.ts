import { getLogger } from '@/lib/logger/use-logger-client';
import type { Device } from '@/types/device';

export async function fetchDevices(): Promise<Device[]> {
  try {
    const response = await fetch('/api/devices', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`);
    }

    const devices = await response.json();
    return devices;
  } catch (error) {
    getLogger().error({ err: error }, 'Error fetching devices');
    return [];
  }
}
