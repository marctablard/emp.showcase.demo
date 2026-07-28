import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { createEmporixClient } from './emporix';
import { syncEntity, syncSchema } from './schema-util';
import type { EntityDefinition, SchemaDefinition, EntitySyncResult, SchemaSyncResult } from './schema-util';

// Load environment variables
dotenv.config();

// ---------------------------------------------------------------------------
// Directories containing JSON definitions
// ---------------------------------------------------------------------------
const ENTITIES_DIR = path.resolve(__dirname, '..', 'entities');
const SCHEMAS_DIR = path.resolve(__dirname, '..', 'schemas');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJsonFiles<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠  Directory not found: ${dir}`);
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const items: T[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      items.push(JSON.parse(raw) as T);
      console.log(`   Loaded ${file}`);
    } catch (err) {
      console.error(`   ✗ Failed to parse ${file}:`, err);
    }
  }

  return items;
}

function printEntityResult(result: EntitySyncResult): void {
  const icon = result.action === 'error' ? '✗' : result.action === 'up-to-date' ? '✓' : '↑';
  console.log(`   ${icon} [${result.entityId}] ${result.action} — ${result.message}`);
}

function printSchemaResult(result: SchemaSyncResult): void {
  const icon = result.action === 'error' ? '✗' : result.action === 'up-to-date' ? '✓' : '↑';
  console.log(`   ${icon} [${result.schemaId}] ${result.action} — ${result.message}`);
}

async function generateAccessToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  try {
    const tokenUrl = `${baseUrl}/oauth/token`;
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Token generation failed (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Token generation failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Resolve configuration from env
  const tenant = process.env.NEXT_PUBLIC_EMPORIX_TENANT;
  const apiEndpoint = process.env.NEXT_PUBLIC_EMPORIX_BASE_URL;
  let accessToken = process.env.EMPORIX_SCHEMA_ACCESS_TOKEN;

  if (!tenant || !apiEndpoint) {
    console.error(
      'Missing required environment variables.\n' +
      'Please set: NEXT_PUBLIC_EMPORIX_TENANT, NEXT_PUBLIC_EMPORIX_BASE_URL',
    );
    process.exit(1);
  }

  // Auto-generate access token if not provided
  if (!accessToken) {
    const schemaClientId = process.env.NEXT_EMPORIX_SCHEMA_CLIENT_ID;
    const schemaClientSecret = process.env.NEXT_EMPORIX_SCHEMA_CLIENT_SECRET;

    if (!schemaClientId || !schemaClientSecret) {
      console.error(
        'Missing EMPORIX_SCHEMA_ACCESS_TOKEN.\n' +
        'Either provide EMPORIX_SCHEMA_ACCESS_TOKEN or set NEXT_EMPORIX_SCHEMA_CLIENT_ID and NEXT_EMPORIX_SCHEMA_CLIENT_SECRET to auto-generate it.',
      );
      process.exit(1);
    }

    console.log('🔑 Generating access token...');
    try {
      accessToken = await generateAccessToken(apiEndpoint, schemaClientId, schemaClientSecret);
      console.log('✅ Access token generated successfully\n');
    } catch (error: any) {
      console.error('❌ Failed to generate access token:', error.message);
      process.exit(1);
    }
  }

  const client = createEmporixClient({ tenant, apiEndpoint, accessToken });

  console.log(`\n🔧 Schema Update — tenant: ${tenant}`);
  console.log(`   API: ${apiEndpoint}\n`);

  // --- Entities ---
  console.log('📦 Loading entity definitions from scripts/entities/ ...');
  const entities = loadJsonFiles<EntityDefinition>(ENTITIES_DIR);

  if (entities.length === 0) {
    console.log('   No entity definitions found.\n');
  } else {
    console.log(`\n🔄 Syncing ${entities.length} entities ...\n`);
    let entityErrors = 0;

    for (const entity of entities) {
      const result = await syncEntity(client, entity);
      printEntityResult(result);
      if (result.action === 'error') entityErrors++;
    }

    if (entityErrors > 0) {
      console.error(`\n   ⚠  ${entityErrors} entity error(s) encountered.`);
      process.exit(1);
    }
  }

  // --- Schemas ---
  console.log('\n📦 Loading schema definitions from scripts/schemas/ ...');
  const schemas = loadJsonFiles<SchemaDefinition>(SCHEMAS_DIR);

  if (schemas.length === 0) {
    console.log('   No schema definitions found.\n');
  } else {
    console.log(`\n🔄 Syncing ${schemas.length} schemas ...\n`);
    let schemaErrors = 0;

    for (const schema of schemas) {
      const result = await syncSchema(client, schema);
      printSchemaResult(result);
      if (result.action === 'error') schemaErrors++;
    }

    if (schemaErrors > 0) {
      console.error(`\n   ⚠  ${schemaErrors} schema error(s) encountered.`);
      process.exit(1);
    }
  }

  console.log('\n✅ Schema update complete.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
