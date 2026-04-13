import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { CompanyService } from '@/platform/services/company/CompanyService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/companies
 * Get all companies assigned to the current user
 */
export async function GET() {
  try {
    const companyService = server.get<CompanyService>('CompanyService');
    const companies = await companyService.getCompanies();
    return NextResponse.json(companies);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/companies',
        method: 'GET',
      },
      'Error fetching companies',
    );
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}
