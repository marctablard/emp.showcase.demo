# Schema Update Process Documentation

## Overview

The schema-update process is an automated tool for synchronizing custom entities and schemas between local JSON definitions and the Emporix API. It ensures that the remote Emporix tenant's schema configuration matches the local definitions stored in the repository.

## Purpose

- **Synchronize Entities**: Create or update custom entity types in Emporix
- **Synchronize Schemas**: Create or update schema definitions with their attributes
- **Idempotent Operations**: Safely run multiple times without side effects
- **Version Management**: Handle schema versioning and conflict resolution
- **Change Detection**: Only update when differences are detected

## Architecture

### Core Components

1. **`schema-update.ts`** - Main orchestration script
2. **`schema-util.ts`** - Sync logic and comparison utilities
3. **`emporix.ts`** - HTTP client for Emporix API
4. **`scripts/entities/`** - JSON definitions for custom entities
5. **`scripts/schemas/`** - JSON definitions for schemas

### File Structure

```
scripts/
├── setup/
│   ├── schema-update.ts      # Main entry point
│   ├── schema-util.ts        # Sync and comparison logic
│   └── emporix.ts            # API client
├── entities/                 # Custom entity definitions
│   ├── metal.json
│   ├── service_request.json
│   └── ...
└── schemas/                  # Schema definitions
    ├── cfg_metal.json
    ├── cfg_product.json
    └── ...
```

## Configuration

### Environment Variables

The script requires the following environment variables (typically in `.env` file):

#### Required Variables

- **`NEXT_PUBLIC_EMPORIX_TENANT`** - Your Emporix tenant identifier
- **`NEXT_PUBLIC_EMPORIX_BASE_URL`** - Emporix API base URL (e.g., `https://api.emporix.io`)

#### Authentication Options

**Option 1: Direct Access Token**
- **`EMPORIX_ACCESS_TOKEN`** - Pre-generated OAuth access token

**Option 2: Auto-generate Token**
- **`NEXT_EMPORIX_SCHEMA_CLIENT_ID`** - OAuth client ID with schema management permissions
- **`NEXT_EMPORIX_SCHEMA_CLIENT_SECRET`** - OAuth client secret

### Example `.env` Configuration

```env
# Tenant Configuration
NEXT_PUBLIC_EMPORIX_TENANT=your-tenant-name
NEXT_PUBLIC_EMPORIX_BASE_URL=https://api.emporix.io

# Authentication (choose one method)
# Method 1: Direct token
EMPORIX_ACCESS_TOKEN=your-access-token

# Method 2: Auto-generate (recommended)
NEXT_EMPORIX_SCHEMA_CLIENT_ID=your-client-id
NEXT_EMPORIX_SCHEMA_CLIENT_SECRET=your-client-secret
```

## Entity Definitions

### Structure

Entity definitions are stored as JSON files in `scripts/entities/`. Each file defines a custom entity type.

### Format

```json
{
  "id": "ENTITY_TYPE_ID",
  "name": {
    "en": "English Name",
    "de": "German Name"
  }
}
```

### Example: `metal.json`

```json
{
  "id": "METAL",
  "name": {
    "de": "Precious Metal",
    "en": "Precious Metal"
  }
}
```

### Entity Sync Behavior

1. **Not Found (404)**: Creates new entity
2. **Exists**: Compares `name` field
   - If identical: Reports "up-to-date"
   - If different: Updates entity with new name
3. **Error**: Reports error with status code and message

## Schema Definitions

### Structure

Schema definitions are stored as JSON files in `scripts/schemas/`. Each file defines a schema with attributes.

### Format

```json
{
  "id": "schema_id",
  "name": {
    "en": "Schema Name"
  },
  "attributes": [
    {
      "key": "attribute_key",
      "name": {
        "en": "Attribute Name",
        "de": "Attribut Name"
      },
      "type": "TEXT|NUMBER|BOOLEAN|DATE|OBJECT|ARRAY",
      "metadata": {
        "readOnly": false,
        "localized": false,
        "required": true,
        "nullable": false
      },
      "values": [],
      "attributes": [],
      "arrayType": {}
    }
  ],
  "types": ["ENTITY_TYPE"],
  "metadata": {
    "url": "https://...",
    "version": 1
  }
}
```

### Attribute Types

- **`TEXT`** - String values
- **`NUMBER`** - Numeric values
- **`BOOLEAN`** - True/false values
- **`DATE`** - Date/time values
- **`OBJECT`** - Nested object with sub-attributes
- **`ARRAY`** - Array of values (requires `arrayType` definition)

### Attribute Metadata

- **`readOnly`** - Whether the attribute can be modified
- **`localized`** - Whether the attribute supports multiple languages
- **`required`** - Whether the attribute must have a value
- **`nullable`** - Whether null values are allowed

### Schema Sync Behavior

1. **Not Found (404)**: Creates new schema with all attributes
2. **Exists**: Performs deep comparison
   - Compares all attributes (key, name, type, metadata, values, nested attributes)
   - Uses normalized, stable JSON comparison
   - Detects missing, extra, and modified attributes
3. **Up-to-date**: All attributes match exactly
4. **Needs Update**: 
   - Fetches current version from remote
   - Includes version in update payload
   - Retries once on version conflict (409)
5. **Error**: Reports error with details

### Version Conflict Resolution

The script handles optimistic locking via version numbers:

1. Fetch remote schema to get current version
2. Include version in update payload
3. If 409 conflict occurs:
   - Fetch latest version again
   - Retry update with new version
4. If still fails, report error

## Running the Script

### Command

```bash
npm run schema-update
# or
ts-node scripts/setup/schema-update.ts
```

### Execution Flow

```
1. Load environment variables
2. Validate configuration
3. Generate/validate access token
4. Initialize Emporix client
5. Load entity definitions from scripts/entities/
6. Sync each entity:
   - Check if exists
   - Create or update as needed
   - Report result
7. Load schema definitions from scripts/schemas/
8. Sync each schema:
   - Check if exists
   - Compare attributes
   - Create or update as needed
   - Report result
9. Display summary with error count
```

### Output Example

```
🔑 Generating access token...
✅ Access token generated successfully

🔧 Schema Update — tenant: your-tenant
   API: https://api.emporix.io

📦 Loading entity definitions from scripts/entities/ ...
   Loaded metal.json
   Loaded service_request.json

🔄 Syncing 2 entities ...

   ✓ [METAL] up-to-date — Already up-to-date
   ↑ [SERVICE_REQUEST] updated — Name updated

📦 Loading schema definitions from scripts/schemas/ ...
   Loaded cfg_metal.json
   Loaded cfg_product.json

🔄 Syncing 2 schemas ...

   ✓ [cfg_metal] up-to-date — All 4 attributes match
   ↑ [cfg_product] updated — Updated (added: newField; attribute definitions updated)

✅ Schema update complete.
```

### Status Icons

- **✓** - Up-to-date (no changes needed)
- **↑** - Updated (changes applied)
- **✗** - Error (operation failed)

## Comparison Logic

### Entity Comparison

Entities are compared by their `name` field only:
- Serializes both remote and local `name` objects to JSON
- Compares strings for exact match

### Schema Comparison

Schemas undergo deep attribute comparison:

1. **Attribute Set Comparison**
   - Identifies missing attributes (in local but not remote)
   - Identifies extra attributes (in remote but not local)

2. **Attribute Deep Comparison**
   - Normalizes each attribute (fills in defaults)
   - Recursively normalizes nested attributes and arrayType
   - Sorts all object keys for stable comparison
   - Compares serialized JSON strings

3. **Normalization Process**
   - Sets default empty values for optional fields
   - Normalizes nested `attributes` arrays
   - Normalizes `arrayType` definitions
   - Ensures consistent structure

### Stable Comparison

To avoid false positives from key ordering:
- All objects are recursively sorted by key
- Arrays are preserved in order
- Comparison is done on stable JSON strings

## API Client

### EmporixClient Methods

#### Custom Entities

- **`getCustomEntity(entityType)`** - Fetch entity by ID
- **`createCustomEntity(entity)`** - Create new entity
- **`updateCustomEntity(entityId, entity)`** - Update existing entity

#### Schemas

- **`getSchema(schemaId)`** - Fetch schema by ID
- **`getAllSchemas()`** - Fetch all schemas
- **`createSchema(schema)`** - Create new schema
- **`updateSchema(schemaId, schema)`** - Update existing schema

### Request Headers

All requests include:
- **`Authorization`** - Bearer token
- **`Emporix-Tenant`** - Tenant identifier
- **`Content-Type`** - application/json
- **`Accept-Language`** - * (for schema operations)
- **`Content-Language`** - * (for create/update operations)

## Error Handling

### Common Errors

1. **Missing Environment Variables**
   - Script exits with error message
   - Lists required variables

2. **Authentication Failure**
   - Token generation fails
   - Invalid credentials
   - Insufficient permissions

3. **Entity/Schema Not Found (404)**
   - Triggers creation flow
   - Not treated as error

4. **Version Conflict (409)**
   - Automatic retry with latest version
   - Reports error if retry fails

5. **API Errors (4xx, 5xx)**
   - Captured and reported with status code
   - Includes response body for debugging

### Error Reporting

Errors are reported with:
- Entity/Schema ID
- Action attempted
- HTTP status code
- Response body/error message

## Best Practices

### Adding New Entities

1. Create JSON file in `scripts/entities/`
2. Use uppercase ID (e.g., `METAL`, `SERVICE_REQUEST`)
3. Provide localized names (at least `en`)
4. Run schema-update script

### Adding New Schemas

1. Create JSON file in `scripts/schemas/`
2. Use lowercase ID with underscores (e.g., `cfg_metal`)
3. Define all attributes with proper types
4. Link to entity types via `types` array
5. Include metadata (optional but recommended)
6. Run schema-update script

### Modifying Schemas

1. Update JSON file in `scripts/schemas/`
2. Add/remove/modify attributes as needed
3. Do NOT manually change `metadata.version`
4. Run schema-update script
5. Script handles version management automatically

### Testing Changes

1. Test in development environment first
2. Review console output for errors
3. Verify changes in Emporix admin UI
4. Check for missing or extra attributes
5. Validate data integrity

## Troubleshooting

### Script Won't Run

- Check Node.js version compatibility
- Verify all dependencies installed (`npm install`)
- Ensure `.env` file exists and is properly formatted

### Authentication Errors

- Verify tenant name is correct
- Check API endpoint URL
- Validate client credentials
- Ensure token has schema management permissions

### Schema Update Fails

- Check for version conflicts (retry logic should handle)
- Verify schema structure matches expected format
- Look for invalid attribute types
- Check for circular references in nested attributes

### Attributes Not Updating

- Verify JSON syntax is valid
- Check attribute normalization (defaults applied correctly)
- Compare local vs remote manually
- Look for whitespace or encoding issues

### Version Conflicts Persist

- Multiple processes updating simultaneously
- Manual changes in Emporix UI during sync
- Wait and retry
- Check for concurrent deployments

## Advanced Topics

### Custom Attribute Types

For complex nested structures:
- Use `OBJECT` type with `attributes` array
- Use `ARRAY` type with `arrayType` definition
- Nest attributes recursively as needed

### Localization

Attributes can be localized:
- Set `metadata.localized: true`
- Values stored per language code
- Queries can filter by language

### Read-Only Attributes

System-managed attributes:
- Set `metadata.readOnly: true`
- Cannot be modified via API
- Typically set by Emporix internally

## Maintenance

### Regular Tasks

- Review and update entity definitions as business needs change
- Add new schemas for custom data requirements
- Remove obsolete schemas (manual cleanup in Emporix)
- Keep documentation in sync with changes

### Version Control

- Commit all JSON definition files
- Track changes via Git history
- Use meaningful commit messages
- Review changes in pull requests

### Monitoring

- Check script output for errors
- Monitor API rate limits
- Track schema version numbers
- Audit changes in Emporix admin UI

## Security Considerations

- **Never commit access tokens** to version control
- Use environment variables for sensitive data
- Rotate client credentials regularly
- Limit schema management permissions to necessary users
- Use separate credentials for different environments

## Related Documentation

- Emporix Schema API: https://docs.emporix.io/
- Custom Entities: https://docs.emporix.io/schema/custom-entities
- Schema Management: https://docs.emporix.io/schema/schemas

## Support

For issues or questions:
1. Check console output for detailed error messages
2. Review this documentation
3. Consult Emporix API documentation
4. Contact development team
