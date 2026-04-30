import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { EmporixCartApi } from '@/platform/integrations/emporix/cart/EmporixCartApi';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const PROJECT_MIXIN_KEY = 'project';
const PROJECT_MIXIN_SCHEMA = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/project_v1.json';

/**
 * POST /api/cart/[id]/project
 * Assigns or clears the project mixin (mixins.project.projectid) on a cart.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cartId } = await params;
  const logger = server.get<LoggerService>('LoggerService');
  try {
    const { projectId } = (await request.json()) as { projectId: string | null };

    const cartApi = server.get<EmporixCartApi>('EmporixCartApi');

    const mixinValue = projectId ? { projectid: projectId } : {};
    const patch: Record<string, any> = {
      mixins: { [PROJECT_MIXIN_KEY]: mixinValue },
    };
    if (projectId) {
      patch.metadata = { mixins: { [PROJECT_MIXIN_KEY]: PROJECT_MIXIN_SCHEMA } };
    }

    await cartApi.updateCart(cartId, patch);

    logger.info({ cartId, projectId }, 'Cart project mixin updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), cartId },
      'Failed to update cart project mixin',
    );
    return NextResponse.json({ error: 'Failed to update cart project' }, { status: 500 });
  }
}
