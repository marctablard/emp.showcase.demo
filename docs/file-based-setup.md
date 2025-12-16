# File-Based Setup API

The File-Based Setup API allows you to execute setup operations defined in JSON files against the Emporix API. This is useful for initializing data, creating test entities, or performing other setup tasks.

## API Endpoint

```
POST /api/setup
```

## Authentication

All requests to the setup API require authentication using a bearer token. The token must match the `NEXT_SETUP_API_SECRET` environment variable.

```
Authorization: Bearer your-setup-api-secret
```

## File-Based Setup

### Request

To execute a file-based setup, send a POST request with the following JSON body:

```json
{
  "action": "executeFileBasedSetup",
  "directoryPath": "path/to/setup/files",
  "setupId": "optional-setup-id",
  "setupName": "Optional Setup Name"
}
```

Parameters:
- `action`: Must be "executeFileBasedSetup"
- `directoryPath`: Path to the directory containing setup JSON files, relative to the scripts/setup directory
- `setupId` (optional): A unique identifier for this setup operation
- `setupName` (optional): A descriptive name for this setup operation

### Response

```json
{
  "success": true,
  "result": {
    "success": true,
    "message": "Successfully executed X operations from multiple files",
    "details": [
      {
        "success": true,
        "operation": { ... },
        "result": { ... }
      },
      ...
    ]
  }
}
```

## Setup File Format

Setup files should be JSON files containing an array of operation objects. Each operation object has the following structure:

```json
{
  "system": "emporix",
  "endpoint": "METHOD:/path/to/resource",
  "payload": { ... },
  "token": "service",
  "description": "Optional description of this operation",
  "condition": {
    "endpoint": "GET:/path/to/check",
    "evaluate": "exists"
  }
}
```

Fields:
- `system`: The system to execute the operation against (currently only "emporix" is supported)
- `endpoint`: The API endpoint to call, in format METHOD:/path/to/resource
- `payload`: The JSON payload to send with the request (for POST, PUT, PATCH)
- `token`: The token type to use (service, session, anonymous)
- `description`: Optional description of the operation
- `condition`: Optional condition to determine if the operation should be executed

Condition evaluation supports:
- `exists`: The operation is executed if the condition endpoint returns a non-null result
- `notExists`: The operation is executed if the condition endpoint returns null
- `equals:value`: The operation is executed if the condition endpoint returns a result that equals the specified value

## Example

```json
[
  {
    "system": "emporix",
    "endpoint": "GET:/categories",
    "description": "Get all categories"
  },
  {
    "system": "emporix",
    "endpoint": "POST:/categories",
    "payload": {
      "id": "test-category",
      "name": "Test Category"
    },
    "description": "Create a test category",
    "condition": {
      "endpoint": "GET:/categories/test-category",
      "evaluate": "notExists"
    }
  }
]
```
