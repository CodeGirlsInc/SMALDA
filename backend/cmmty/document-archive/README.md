# Document Archive Module

This module provides functionality to archive and unarchive documents within the SMALDA system.

## Overview

The Document Archive module allows users to move documents to an archived state, effectively hiding them from the default list without permanently deleting them. Archived documents can be unarchived at any time to restore them to the active state.

## Features

- **Archive documents**: Move documents to archived state via `POST /cmmty/documents/:id/archive`
- **Unarchive documents**: Restore archived documents via `POST /cmmty/documents/:id/unarchive`
- **List archived documents**: Retrieve paginated list of archived documents via `GET /cmmty/documents/archived`
- **Filter non-archived documents**: Helper method to list only active documents
- **Idempotent operations**: Archive/unarchive operations are safe to call multiple times

## Architecture

### Files

- `document-archive.module.ts` - NestJS module definition
- `document-archive.controller.ts` - HTTP request handlers
- `document-archive.service.ts` - Business logic
- `document-archive.service.spec.ts` - Unit tests
- `dto/archive-response.dto.ts` - Response DTO for archive/unarchive operations
- `dto/archived-documents-query.dto.ts` - Query parameters DTO for listing archived documents

### Database Changes

An `archived` column (boolean, default: false) has been added to the `documents` table to track the archive state of each document.

## API Endpoints

### Archive a Document

```http
POST /cmmty/documents/:id/archive
Authorization: Bearer <JWT_TOKEN>
```

**Response (202 Accepted):**
```json
{
  "id": "doc-123",
  "title": "Document Title",
  "archived": true,
  "message": "Document archived successfully"
}
```

**Error (404 Not Found):**
```json
{
  "message": "Document with id doc-123 not found"
}
```

### Unarchive a Document

```http
POST /cmmty/documents/:id/unarchive
Authorization: Bearer <JWT_TOKEN>
```

**Response (202 Accepted):**
```json
{
  "id": "doc-123",
  "title": "Document Title",
  "archived": false,
  "message": "Document unarchived successfully"
}
```

### List Archived Documents

```http
GET /cmmty/documents/archived?page=1&limit=10
Authorization: Bearer <JWT_TOKEN>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "doc-1",
      "ownerId": "user-123",
      "title": "Archived Document 1",
      "filePath": "/path/to/file1.pdf",
      "fileHash": "abc123",
      "fileSize": 2048,
      "mimeType": "application/pdf",
      "status": "verified",
      "riskScore": 0.5,
      "riskFlags": [],
      "archived": true,
      "createdAt": "2024-04-20T10:30:00Z",
      "updatedAt": "2024-04-22T14:15:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

## Service Methods

### `archive(id: string): Promise<ArchiveResponseDto>`

Archives a document by ID. Returns immediately if document is already archived.

### `unarchive(id: string): Promise<ArchiveResponseDto>`

Unarchives a document by ID. Returns immediately if document is not archived.

### `getArchivedDocuments(page: number, limit: number): Promise<PaginatedArchivedDocuments>`

Retrieves a paginated list of archived documents, ordered by creation date (newest first).

### `getNonArchivedDocuments(page: number, limit: number): Promise<PaginatedArchivedDocuments>`

Retrieves a paginated list of non-archived (active) documents, ordered by creation date (newest first).

## Testing

Comprehensive unit tests are included covering:

- Successful archive/unarchive operations
- Idempotent behavior (archive/unarchive already in that state)
- Error handling (document not found)
- Pagination for archived documents
- State transitions (archive → unarchive → archive)
- Filtering of archived vs non-archived documents

Run tests with:
```bash
npm test -- document-archive.service.spec.ts
```

## Design Decisions

1. **Soft Delete Pattern**: Uses a boolean flag instead of hard deletion to preserve data integrity and allow recovery.

2. **Idempotent Operations**: Archive/unarchive endpoints are safe to call multiple times without side effects.

3. **Paginated Responses**: List endpoints include pagination to handle large numbers of documents efficiently.

4. **Separate Endpoint for Archived Documents**: Keeps the default list of documents clean by providing a separate endpoint for archived items.

5. **JWT Authentication**: All endpoints require JWT authentication to ensure only authorized users can archive/unarchive documents.

## Integration with Existing Services

The module extends the Document entity with an `archived` boolean field. When querying for documents in other parts of the system (e.g., search, list), services should filter out archived documents by default unless explicitly requesting them.

Example:
```typescript
// Get non-archived documents for a user
const documents = await this.documentArchiveService.getNonArchivedDocuments(1, 10);
```
