import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET() {
  try {
    const companyService = server.get<CompanyService>('CompanyService');
    const addresses = await companyService.getLegalEntityCheckoutAddresses();
    return NextResponse.json(addresses);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/customer/current/legal-entity-addresses',
        method: 'GET',
      },
      'Error fetching legal entity checkout addresses',
    );
    return NextResponse.json({ error: 'Failed to fetch legal entity addresses' }, { status: 500 });
  }
}
