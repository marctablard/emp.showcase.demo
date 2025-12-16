import { SetupOperation } from './fileBasedSetup';

/**
 * Service for executing Emporix-specific setup operations
 */
export interface EmporixSetupService {
  /**
   * Execute a setup operation against the Emporix API
   * @param operation The operation to execute
   * @returns The result of the operation
   */
  executeOperation(operation: SetupOperation): Promise<any>;
}
