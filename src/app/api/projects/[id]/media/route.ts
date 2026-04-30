import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProjectService } from '@/platform/services/project/ProjectService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const projectService = server.get<ProjectService>('ProjectService');
    const media = await projectService.getProjectMedia(id);
    return NextResponse.json(media);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error fetching project media');
    return NextResponse.json({ error: 'Failed to fetch project media' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const projectService = server.get<ProjectService>('ProjectService');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const asset = await projectService.uploadProjectMedia(id, file, file.name, file.type);
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error uploading project media');
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
