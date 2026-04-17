import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SetupResult, SetupService } from '@/platform/services/model/setup/setup';

/**
 * Verify the setup API secret from the request
 * @param request The incoming request
 * @returns Whether the secret is valid
 */
function verifySetupApiSecret(request: NextRequest): boolean {
  const logger = server.get<LoggerService>('LoggerService');
  // Check if setup API is enabled
  if (process.env.NEXT_SETUP_API_ENABLED !== 'true') {
    logger.warn('Setup API is disabled. Enable it by setting NEXT_SETUP_API_ENABLED=true');
    return false;
  }

  // Get the secret from the request
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header');
    return false;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const expectedSecret = process.env.NEXT_SETUP_API_SECRET;

  if (!expectedSecret) {
    logger.warn('NEXT_SETUP_API_SECRET is not configured');
    return false;
  }

  // Compare the token with the expected secret
  return token === expectedSecret;
}

/**
 * Execute all registered setup steps
 * @returns Results of all setup steps
 */
async function executeSetupSteps(): Promise<Record<string, SetupResult>> {
  const logger = server.get<LoggerService>('LoggerService');
  const results: Record<string, SetupResult> = {};

  // Get the list of setup step services from environment variable
  const setupStepServices = process.env.NEXT_SETUP_STEP_SERVICES?.split(',') || [];

  if (setupStepServices.length === 0) {
    logger.warn('No setup step services configured in NEXT_SETUP_STEP_SERVICES');
    return {
      system: {
        success: false,
        error: 'No setup step services configured',
      },
    };
  }

  logger.info(
    { setupStepServices },
    `Executing ${setupStepServices.length} setup steps: ${setupStepServices.join(', ')}`,
  );

  // Execute each setup step
  for (const serviceName of setupStepServices) {
    try {
      const service = server.get<SetupService>(serviceName);

      if (!service) {
        logger.warn({ serviceName }, `Setup step service '${serviceName}' not found in container`);
        results[serviceName] = {
          success: false,
          error: `Service '${serviceName}' not found in container`,
        };
        continue;
      }

      logger.info(
        { serviceId: service.id, serviceName: service.name },
        `Executing setup step: ${service.name} (${service.id})`,
      );
      const result = await service.execute();
      results[service.id] = result;
      logger.info({ serviceId: service.id, result }, `Setup step ${service.id} completed with result`);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          serviceName,
        },
        `Error executing setup step ${serviceName}`,
      );
      results[serviceName] = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return results;
}

/**
 * Execute a specific setup step by ID
 * @param stepId The ID of the step to execute
 * @returns Result of the setup step
 */
async function executeSetupStep(stepId: string): Promise<SetupResult> {
  // Get the list of setup step services from environment variable
  const setupStepServices = process.env.NEXT_SETUP_STEP_SERVICES?.split(',') || [];

  if (setupStepServices.length === 0) {
    return {
      success: false,
      error: 'No setup step services configured',
    };
  }

  // Find the service that implements the step with the given ID
  for (const serviceName of setupStepServices) {
    try {
      const service = server.get<SetupService>(serviceName);

      if (!service) {
        continue;
      }

      if (service.id === stepId) {
        const logger = server.get<LoggerService>('LoggerService');
        logger.info(
          { serviceId: service.id, serviceName: service.name },
          `Executing setup step: ${service.name} (${service.id})`,
        );
        const result = await service.execute();
        logger.info({ serviceId: service.id, result }, `Setup step ${service.id} completed with result`);
        return result;
      }
    } catch (error) {
      const logger = server.get<LoggerService>('LoggerService');
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          serviceName,
        },
        `Error checking setup step ${serviceName}`,
      );
    }
  }

  return {
    success: false,
    error: `Setup step with ID '${stepId}' not found`,
  };
}

export async function GET(request: NextRequest) {
  // Verify the setup API secret
  if (!verifySetupApiSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 },
    );
  }

  try {
    // Execute all setup steps
    const results = await executeSetupSteps();
    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Execute a file-based setup operation
 * @returns Result of the setup operation
 */
async function executeFileBasedSetup(): Promise<SetupResult> {
  const logger = server.get<LoggerService>('LoggerService');
  try {
    // Get the FileBasedSetupService from the container
    const service = server.get<SetupService>('FileBasedSetupService');

    if (!service) {
      return {
        success: false,
        error: 'FileBasedSetupService not found in container',
      };
    }

    logger.info('Executing file-based setup');
    const result = await service.execute();
    logger.info({ result }, 'File-based setup completed with result');

    return result;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error executing file-based setup',
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(request: NextRequest) {
  // Verify the setup API secret
  if (!verifySetupApiSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { action, stepId } = body;

    if (action === 'executeAll') {
      // Execute all setup steps
      const results = await executeSetupSteps();
      return NextResponse.json({
        success: true,
        results,
      });
    } else if (action === 'executeStep' && stepId) {
      // Execute a specific setup step
      const result = await executeSetupStep(stepId);
      return NextResponse.json({
        success: result.success,
        result,
      });
    } else if (action === 'executeFileBasedSetup') {
      // Execute a file-based setup
      const result = await executeFileBasedSetup();
      return NextResponse.json({
        success: result.success,
        result,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown action or missing required parameters',
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
