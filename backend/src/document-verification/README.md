# Document Verification Workflow Module

A minimal, self-contained NestJS module for managing document verification workflows with a state machine.

## Features

- **State Machine**: SUBMITTED → PENDING_REVIEW → (APPROVED | REJECTED)
- **Document Management**: Create, retrieve, and list documents
- **Status Transitions**: Enforced validation of allowed state transitions
- **Audit Trail**: Track who submitted and who reviewed each document

## Architecture

```
src/document-verification/
├── entities/           # Database models
├── enums/             # Status constants
├── services/          # Business logic & state machine
├── controllers/       # HTTP endpoints
├── dtos/             # Request/response schemas
└── document-verification.module.ts
```

## Integration Steps

### 1. Import Module in Your App Module

```typescript
import { DocumentVerificationModule } from './document-verification/document-verification.module';

@Module({
  imports: [
    // ... other imports
    DocumentVerificationModule,
  ],
})
export class AppModule {}
```

### 2. Add Entity to TypeORM Configuration

In your `ormconfig.ts` or TypeORM config:

```typescript
entities: [
  // ... other entities
  'src/document-verification/entities/*.ts',
]
```

### 3. Run Migration

```bash
npm run typeorm migration:run
```

## API Endpoints

### Create Document
```
POST /documents
Body: {
  "title": "string",
  "description": "string?",
  "submittedBy": "string"
}
Response: DocumentResponseDto
```

### Get All Documents
```
GET /documents?status=PENDING_REVIEW
Response: DocumentResponseDto[]
```

### Get Document by ID
```
GET /documents/:id
Response: DocumentResponseDto
```

### Update Document Status
```
PUT /documents/:id/status
Body: {
  "status": "APPROVED | REJECTED | PENDING_REVIEW",
  "rejectionReason": "string?" (required if REJECTED),
  "reviewedBy": "string"
}
Response: DocumentResponseDto
```

### Get Allowed Transitions
```
GET /documents/:id/transitions
Response: DocumentStatus[]
```

## State Transitions

| Current Status | Allowed Next States | Notes |
|---|---|---|
| SUBMITTED | PENDING_REVIEW | Initial submission |
| PENDING_REVIEW | APPROVED, REJECTED | Reviewer action |
| APPROVED | - | Terminal state |
| REJECTED | - | Terminal state |

## Example Usage

```bash
# Create document
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Passport Verification",
    "submittedBy": "user123"
  }'

# Get allowed transitions
curl http://localhost:3000/documents/{id}/transitions

# Approve document
curl -X PUT http://localhost:3000/documents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reviewedBy": "reviewer456"
  }'

# Reject document
curl -X PUT http://localhost:3000/documents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REJECTED",
    "rejectionReason": "Invalid document quality",
    "reviewedBy": "reviewer456"
  }'
```

## Extending the Module

To add custom logic:

1. **Add new states**: Update `DocumentStatus` enum and state machine transitions
2. **Custom validations**: Extend `updateDocumentStatus()` in `DocumentService`
3. **Notifications**: Hook into service methods after status updates
4. **Audit events**: Emit custom events on state transitions

## Notes

- The module uses UUID for document IDs
- Status is stored as PostgreSQL ENUM for data integrity
- Timestamps (createdAt, updatedAt) are automatic
- State machine prevents invalid transitions with `BadRequestException`
