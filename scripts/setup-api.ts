import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

type SetupAction = 'executeAll' | 'executeStep';

interface SetupOptions {
  action: SetupAction;
  stepId?: string;
  method?: 'GET' | 'POST';
}

/**
 * Execute setup steps via the API endpoint
 */
async function executeSetup(options: SetupOptions = { action: 'executeAll', method: 'GET' }) {
  try {
    // Verify required environment variables
    if (!process.env.NEXT_SETUP_API_SECRET) {
      throw new Error('NEXT_SETUP_API_SECRET environment variable is not set');
    }

    if (process.env.NEXT_SETUP_API_ENABLED !== 'true') {
      console.warn('Warning: NEXT_SETUP_API_ENABLED is not set to true. The API endpoint may reject requests.');
    }

    console.log(`Starting setup via API route (action: ${options.action})...`);
    
    // Determine the base URL (default to localhost:3000 if not specified)
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/setup`;
    
    console.log(`Calling API endpoint: ${url}`);
    
    // Prepare request options
    const requestOptions: RequestInit = {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_SETUP_API_SECRET}`
      }
    };

    // Add body for POST requests
    if (options.method !== 'GET') {
      const body: Record<string, any> = { action: options.action };
      
      if (options.action === 'executeStep' && options.stepId) {
        body.stepId = options.stepId;
      }
      
      requestOptions.body = JSON.stringify(body);
    }
    
    // Make the API request
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Setup completed successfully!');
      
      // Handle different response formats
      if (result.results) {
        // Multiple results from executeAll
        console.log('\nResults by step:');
        Object.entries(result.results).forEach(([stepId, stepResult]: [string, any]) => {
          console.log(`\n[${stepId}]`);
          console.log(`  Success: ${stepResult.success}`);
          if (stepResult.message) console.log(`  Message: ${stepResult.message}`);
          if (stepResult.error) console.log(`  Error: ${stepResult.error}`);
        });
      } else if (result.result) {
        // Single result from executeStep
        console.log(`\nStep result:`);
        console.log(`  Success: ${result.result.success}`);
        if (result.result.message) console.log(`  Message: ${result.result.message}`);
        if (result.result.error) console.log(`  Error: ${result.result.error}`);
      }
    } else {
      console.error('Setup failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during setup:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Parse command line arguments and execute the setup
 */
function parseArgsAndExecute() {
  const args = process.argv.slice(2);
  const options: SetupOptions = { action: 'executeAll' };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--action' || arg === '-a') {
      const actionArg = args[++i];
      if (actionArg === 'executeAll' || actionArg === 'executeStep') {
        options.action = actionArg;
      } else {
        console.error(`Invalid action: ${actionArg}. Must be 'executeAll' or 'executeStep'.`);
        process.exit(1);
      }
    } else if (arg === '--step' || arg === '-s') {
      options.stepId = args[++i];
      // If step is specified but action isn't, default to executeStep
      if (options.action === 'executeAll') {
        options.action = 'executeStep';
      }
    } else if (arg === '--get' || arg === '-g') {
      options.method = 'GET';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: ts-node setup-api.ts [options]

Options:
  --action, -a <action>   Action to perform: 'executeAll' or 'executeStep' (default: executeAll)
  --step, -s <stepId>     Step ID to execute (required for executeStep)
  --get, -g               Use GET method instead of POST
  --help, -h              Show this help message
`);
      process.exit(0);
    }
  }
  
  // Validate options
  if (options.action === 'executeStep' && !options.stepId) {
    console.error('Error: --step parameter is required when using executeStep action');
    process.exit(1);
  }
  
  // Execute setup with parsed options
  executeSetup(options);
}

// Parse arguments and execute
parseArgsAndExecute();
