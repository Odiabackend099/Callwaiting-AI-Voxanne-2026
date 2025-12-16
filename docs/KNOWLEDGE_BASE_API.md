# Knowledge Base API Documentation

## Overview

The Knowledge Base API provides endpoints for managing multi-file knowledge bases for organizations. Knowledge bases are synced to Vapi assistants (both inbound and outbound) to provide consistent persona and information across all agent interactions.

## Base URL

```
/api/knowledge-base
```

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Organization ID must be provided via `X-Org-Id` header or extracted from JWT claims.

## Rate Limiting

- **Sync endpoint**: 1 request per 5 minutes per organization
- **Other endpoints**: No rate limiting
- Rate limit errors return HTTP 429 with remaining wait time

## Data Types

### KBCategory

Enum of valid knowledge base categories:
- `products_services` - Product and service information
- `operations` - Operational procedures and guidelines
- `ai_guidelines` - AI agent guidelines and instructions
- `general` - General information (default)

### KBDocument

```json
{
  "id": "uuid",
  "org_id": "uuid",
  "filename": "string (max 255 chars)",
  "content": "string (max 300KB)",
  "category": "products_services|operations|ai_guidelines|general",
  "version": 1,
  "active": true,
  "metadata": {
    "source": "dashboard|beverly_seed",
    "bytes": 1024,
    "vapi_file_id": "string (optional)",
    "synced_at": "ISO8601 (optional)"
  },
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

## Endpoints

### GET /api/knowledge-base

List all knowledge base documents for the organization.

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "filename": "pricing.md",
      "content": "# Pricing\n...",
      "category": "products_services",
      "version": 1,
      "active": true,
      "created_at": "2025-12-15T10:00:00Z",
      "updated_at": "2025-12-15T10:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Server error

---

### POST /api/knowledge-base

Create a new knowledge base document.

**Request Body:**
```json
{
  "filename": "pricing.md",
  "content": "# Pricing\n\nEssentials: £169/mo",
  "category": "products_services",
  "active": true
}
```

**Parameters:**
- `filename` (required): Document filename, max 255 characters. Cannot contain path separators (`/`, `\`) or traversal sequences (`..`)
- `content` (required): Document content, max 300KB. Cannot be empty or whitespace-only
- `category` (optional): One of the KBCategory values. Defaults to `general`
- `active` (optional): Whether document is active. Defaults to `true`

**Response:**
```json
{
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "pricing.md",
    "content": "# Pricing\n\nEssentials: £169/mo",
    "category": "products_services",
    "version": 1,
    "active": true,
    "created_at": "2025-12-15T10:00:00Z",
    "updated_at": "2025-12-15T10:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Document created
- `400` - Invalid input (filename too long, invalid category, content too large, etc.)
- `401` - Unauthorized
- `500` - Server error

**Error Examples:**
```json
{
  "error": "Invalid input: Filename cannot contain path separators or traversal sequences"
}
```

---

### PATCH /api/knowledge-base/:id

Update an existing knowledge base document.

**URL Parameters:**
- `id` (required): Document ID (UUID)

**Request Body:**
```json
{
  "filename": "pricing-updated.md",
  "content": "# Updated Pricing\n...",
  "category": "operations",
  "active": false
}
```

**Parameters:**
- `filename` (optional): New filename
- `content` (optional): New content. Updates version number if provided
- `category` (optional): New category
- `active` (optional): Active status

**Response:**
```json
{
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "pricing-updated.md",
    "content": "# Updated Pricing\n...",
    "category": "operations",
    "version": 2,
    "active": false,
    "created_at": "2025-12-15T10:00:00Z",
    "updated_at": "2025-12-15T10:05:00Z"
  }
}
```

**Status Codes:**
- `200` - Document updated
- `400` - Invalid input
- `401` - Unauthorized
- `404` - Document not found
- `500` - Server error

**Notes:**
- Version number increments only when `content` is updated
- Updating other fields does not increment version
- Document history is tracked in changelog table

---

### DELETE /api/knowledge-base/:id

Soft-delete a knowledge base document.

**URL Parameters:**
- `id` (required): Document ID (UUID)

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Document deleted (soft-deleted, marked inactive)
- `401` - Unauthorized
- `404` - Document not found
- `500` - Server error

**Notes:**
- Deletion is soft (sets `active=false`), not hard
- Document remains in database for audit trail
- Deleted documents are excluded from sync operations

---

### POST /api/knowledge-base/seed/beverly

Seed the knowledge base with default Beverly (Sarah) sales agent content.

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "seeded": 3,
  "message": "Knowledge base seeded with 3 documents",
  "items": [
    {
      "id": "uuid",
      "filename": "beverly_product_guide.md",
      "content": "...",
      "category": "products_services",
      "version": 1,
      "active": true
    },
    {
      "id": "uuid",
      "filename": "beverly_objections.md",
      "content": "...",
      "category": "operations",
      "version": 1,
      "active": true
    },
    {
      "id": "uuid",
      "filename": "beverly_call_script.md",
      "content": "...",
      "category": "ai_guidelines",
      "version": 1,
      "active": true
    }
  ]
}
```

**Status Codes:**
- `200` - Seed successful or skipped (if KB already has documents)
- `400` - Seed document too large
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- Only seeds if organization has no existing KB documents
- Creates 3 default documents: product guide, objections, call script
- Safe to call multiple times (idempotent)

---

### POST /api/knowledge-base/sync

Sync knowledge base documents to Vapi assistants.

**Request Body:**
```json
{
  "toolName": "knowledge-search",
  "assistantRoles": ["inbound", "outbound"]
}
```

**Parameters:**
- `toolName` (optional): Name of Vapi Query Tool. Defaults to `knowledge-search`
- `assistantRoles` (optional): Array of agent roles to sync to. Defaults to `["inbound", "outbound"]`

**Response:**
```json
{
  "success": true,
  "toolId": "vapi-tool-id-123",
  "assistantsUpdated": [
    {
      "role": "inbound",
      "assistantId": "vapi-assistant-id-1"
    },
    {
      "role": "outbound",
      "assistantId": "vapi-assistant-id-2"
    }
  ]
}
```

**Status Codes:**
- `200` - Sync successful
- `400` - No active documents or no agents found
- `401` - Unauthorized
- `429` - Rate limited (try again in X seconds)
- `500` - Server error (Vapi API failure, metadata update failure, etc.)

**Error Examples:**
```json
{
  "error": "No active knowledge base documents to sync"
}
```

```json
{
  "error": "No agents found for this organization. Create agents before syncing."
}
```

```json
{
  "error": "Rate limited. Try again in 245s."
}
```

**Notes:**
- Groups KB documents by category for Vapi knowledge bases
- Creates or updates Vapi Query Tool with all KB files
- Attaches tool to all specified agents
- Rate limited to 1 sync per 5 minutes per organization
- Syncs to both inbound and outbound agents by default for consistent persona
- Metadata is updated with Vapi file IDs for tracking

---

## Error Handling

All errors return JSON with an `error` field:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Invalid input: ...` | Validation error (invalid category, filename too long, etc.) |
| 400 | `File too large. Max 300000 bytes.` | Content exceeds 300KB limit |
| 400 | `No active knowledge base documents to sync` | Sync attempted with no active documents |
| 400 | `No agents found for this organization` | Sync attempted with no agents |
| 401 | `Unauthorized` | Missing or invalid authentication |
| 404 | `Knowledge base document not found` | Document ID doesn't exist or doesn't belong to org |
| 429 | `Rate limited. Try again in Xs.` | Sync rate limit exceeded |
| 500 | `Failed to record change history` | Changelog insert failed |
| 500 | `Failed to update file metadata` | Metadata update failed during sync |
| 500 | `Failed to sync knowledge base` | Vapi API error or other sync failure |

---

## Examples

### Create a Product Guide Document

```bash
curl -X POST http://localhost:3001/api/knowledge-base \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-Id: <org-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "product-guide.md",
    "content": "# Product Guide\n\n## Features\n- Feature 1\n- Feature 2",
    "category": "products_services"
  }'
```

### Update a Document

```bash
curl -X PATCH http://localhost:3001/api/knowledge-base/<doc-id> \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-Id: <org-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Updated Product Guide\n\n## New Features\n- Feature 3"
  }'
```

### Sync to Vapi

```bash
curl -X POST http://localhost:3001/api/knowledge-base/sync \
  -H "Authorization: Bearer <token>" \
  -H "X-Org-Id: <org-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "knowledge-search",
    "assistantRoles": ["inbound", "outbound"]
  }'
```

---

## Versioning

- Knowledge base documents are versioned
- Version increments when content is updated
- Previous versions are tracked in changelog table
- Soft deletes preserve version history

---

## Audit Trail

All changes are logged in the `knowledge_base_changelog` table:
- Document creation
- Content updates (with version tracking)
- Soft deletes
- User who made the change
- Timestamp of change

---

## Best Practices

1. **Always validate input**: Filenames and content are validated server-side
2. **Use appropriate categories**: Choose category that best describes content
3. **Keep content concise**: Shorter documents sync faster to Vapi
4. **Test sync before production**: Verify agents receive KB tool correctly
5. **Monitor sync logs**: Check `kb_sync_log` table for sync history and errors
6. **Seed Beverly KB**: Use seed endpoint to get started with default content
7. **Respect rate limits**: Wait before retrying sync if rate limited

---

## Changelog

### Version 1.0 (2025-12-15)
- Initial release
- CRUD operations for KB documents
- Sync to Vapi assistants
- Beverly KB seed endpoint
- Input validation and sanitization
- Soft delete implementation
- Rate limiting
- Changelog tracking
