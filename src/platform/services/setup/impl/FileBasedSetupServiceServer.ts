import fs from 'fs/promises';
import { inject } from 'inversify';
import path from 'path';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { SetupResult, SetupService } from '@/platform/services/model/setup/setup';
import type { SetupOperation } from '@/platform/services/model/setup/setup';
import type { EmporixSetupService } from '../EmporixSetupService';

/**
 * A setup step service that reads operations from a JSON file and executes them
 */
@injectable('FileBasedSetupService', 'Singleton')
export class FileBasedSetupServiceServer implements SetupService {
  id = 'file-based-setup';
  name = 'File-Based Setup';

  constructor(
    @inject('EmporixSetupService') private emporixSetupService: EmporixSetupService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  /**
   * Execute the setup step by reading operations from all files in the directory and executing them
   */
  async execute(): Promise<SetupResult> {
    try {
      this.logger.info(
        {
          serviceId: this.id,
          serviceName: this.name,
        },
        `Executing file-based setup step: ${this.name} (${this.id})`,
      );

      // Read all setup files in the directory
      const operations = await this.readSetupFile();
      this.logger.info(
        {
          operationCount: operations.length,
        },
        `Found ${operations.length} operations to execute from directory`,
      );

      // Execute each operation
      const results = [];
      for (let index = 0; index < operations.length; index++) {
        const operation = operations[index];
        try {
          this.logger.info(
            {
              operationIndex: index + 1,
              operationDescription: operation.description || operation.endpoint,
            },
            `Executing operation ${index + 1}: ${operation.description || operation.endpoint}`,
          );
          const result = await this.executeOperation(operation);
          results.push({
            success: true,
            operation,
            result,
          });
        } catch (error) {
          this.logger.error(
            {
              err: error instanceof Error ? error : String(error),
              operationIndex: index + 1,
              operation,
            },
            `Error executing operation ${index + 1}`,
          );
          results.push({
            success: false,
            operation,
            error: error instanceof Error ? error.message : String(error),
          });

          // If an operation fails, we continue with the next one
          // This allows partial setup completion
        }
      }

      // Check if any operations failed
      const failedOperations = results.filter((r) => !r.success);
      if (failedOperations.length > 0) {
        return {
          success: false,
          error: `${failedOperations.length} operations failed`,
          details: results,
        };
      }

      return {
        success: true,
        message: `Successfully executed ${results.length} operations from multiple files`,
        details: results,
      };
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          serviceId: this.id,
        },
        `Error executing file-based setup step: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Read all setup files in the directory and parse the operations.
   * Scans both scripts/setup and enabled extension setup directories.
   */
  private async readSetupFile(): Promise<SetupOperation[]> {
    try {
      const allOperations: SetupOperation[] = [];

      // 1. Read from the standard scripts/setup directory
      const setupDir = path.resolve(process.cwd(), 'scripts', 'setup');
      await this.readSetupDir(setupDir, allOperations);

      // 2. Read from enabled extension setup directories
      const extensionsDir = path.resolve(process.cwd(), 'extensions');
      try {
        await fs.access(extensionsDir);
        const extEntries = await fs.readdir(extensionsDir, { withFileTypes: true });
        for (const entry of extEntries) {
          if (!entry.isDirectory()) continue;
          const manifestPath = path.join(extensionsDir, entry.name, 'plugin.json');
          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestContent);
            if (!manifest.enabled) continue;

            // Read setup files listed in the manifest
            if (Array.isArray(manifest.setup)) {
              for (const setupFile of manifest.setup) {
                const setupFilePath = path.join(extensionsDir, entry.name, setupFile);
                try {
                  const fileContent = await fs.readFile(setupFilePath, 'utf-8');
                  const fileOperations = JSON.parse(fileContent);
                  if (Array.isArray(fileOperations)) {
                    allOperations.push(...fileOperations);
                    this.logger.info(
                      { extension: manifest.name, file: setupFile },
                      `Loaded ${fileOperations.length} setup operations from extension '${manifest.name}': ${setupFile}`,
                    );
                  }
                } catch (_err) {
                  this.logger.warn(
                    { extension: manifest.name, file: setupFile },
                    `Failed to read extension setup file: ${setupFile}`,
                  );
                }
              }
            }
          } catch (_err) {
            // No plugin.json or not readable — skip
          }
        }
      } catch (_err) {
        // No extensions directory — that's fine
      }

      return allOperations;
    } catch (error) {
      throw new Error(`Failed to read setup files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read all JSON setup files from a single directory
   */
  private async readSetupDir(directoryPath: string, allOperations: SetupOperation[]): Promise<void> {
    try {
      await fs.access(directoryPath);
    } catch (_error) {
      this.logger.warn({}, `Setup directory not found: ${directoryPath}`);
      return;
    }

    const files = await fs.readdir(directoryPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));
    jsonFiles.sort();

    for (const file of jsonFiles) {
      const filePath = path.join(directoryPath, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const fileOperations = JSON.parse(fileContent);

      if (!Array.isArray(fileOperations)) {
        throw new Error(`Invalid setup file format in ${file}: expected an array of operations`);
      }

      allOperations.push(...fileOperations);
    }
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: SetupOperation): Promise<any> {
    // Check which system this operation is for
    const system = operation.system?.toLowerCase() || 'emporix';

    // Use the appropriate service based on the system
    switch (system) {
      case 'emporix':
        return await this.emporixSetupService.executeOperation(operation);
      default:
        throw new Error(`Unsupported system: ${operation.system}`);
    }
  }

  // parseEndpoint method has been moved to EmporixSetupService

  /**
   * Evaluate a condition to determine if an operation should be executed
   */
  private async evaluateCondition(condition: SetupOperation['condition']): Promise<boolean> {
    if (!condition) return true;

    try {
      // Create a temporary operation for the condition
      const conditionOperation: SetupOperation = {
        system: 'emporix', // Assume conditions are always against Emporix
        endpoint: condition.endpoint,
      };

      // Use the EmporixSetupService to execute the condition operation
      const result = await this.emporixSetupService.executeOperation(conditionOperation);

      // Evaluate the result using the provided evaluation function
      if (condition.evaluate) {
        // Simple evaluation for common patterns
        if (condition.evaluate === 'exists') {
          return result !== null && result !== undefined;
        } else if (condition.evaluate === 'notExists') {
          return result === null || result === undefined;
        } else if (condition.evaluate.startsWith('equals:')) {
          const expectedValue = condition.evaluate.substring(7);
          return JSON.stringify(result) === expectedValue;
        }

        // For more complex evaluations, we would need a proper function evaluation
        // which is beyond the scope of this implementation
        this.logger.warn(
          {
            evaluate: condition.evaluate,
          },
          `Complex evaluation not supported: ${condition.evaluate}`,
        );
      }

      // If no evaluation function is provided or it's not supported,
      // consider the condition met if the request succeeds
      return true;
    } catch (error) {
      // If the condition endpoint fails, consider the condition not met
      this.logger.warn(
        {
          err: error,
        },
        `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

export default FileBasedSetupServiceServer;
