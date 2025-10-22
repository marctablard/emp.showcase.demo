import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { CompanyService } from '@/platform/services/company/CompanyService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const companyService = server.get<CompanyService>('CompanyService');
    const company = await companyService.getCompany(companyId === 'current' ? undefined : companyId);

    if (!company) {
      // Return 204 No Content if no company is found
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}
