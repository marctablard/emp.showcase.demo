import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ProjectService } from '@/platform/services/project/ProjectService';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const { id, mediaId } = await params;
    const projectService = server.get<ProjectService>('ProjectService');
    await projectService.deleteProjectMedia(id, mediaId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error deleting project media');
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
