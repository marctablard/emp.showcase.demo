import client from '@/platform/client';
import type { CMSComponentService } from '../services/CMSComponentService';
import { CMSComponentTypeDefinition } from '../types';

/** Extract all component type definitions from entries */

export function getComponentTypes(theme?: string): CMSComponentTypeDefinition[] {
  const service = client.get<CMSComponentService>('EmporixCMSComponentService');

  return service.getDefinitions(theme).map((entry) => entry.definition);
}
