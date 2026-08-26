# SMALDA Backend Architecture & Contribution Guide

## Overview

SMALDA is a land document management and verification system providing end-to-end auditability, risk assessment, and Stellar blockchain anchoring.

## Document Lifecycle

```
[Document Upload] ➔ [Risk Assessment] ➔ [Queue Processing] ➔ [External Validation] ➔ [Stellar Anchoring] ➔ [Public Verification]
```

1. **Document Upload (`documents/`)**: Land document metadata and files are registered off-chain.
2. **Risk Assessment (`risk-assessment/`)**: Automated evaluation of document authenticity and risk score.
3. **Queue Processing (`queue/`)**: BullMQ handles async processing for verification tasks.
4. **External Validation (`external-validation/`)**: Integration with external registries.
5. **Stellar Anchoring (`stellar/`)**: Document cryptographic hash is anchored on the Stellar ledger.
6. **Public Verification (`verification/`)**: Public route permitting verification of document hash without exposing private owner details.

## API Standards & Guidelines

- **Versioning**: All API routes are prefixed under `/api/v1`.
- **Response Serialization**: Entities must use `ClassSerializerInterceptor` with sensitive properties annotated with `@Exclude()`.
- **Error Contract**: Errors return `{ statusCode, errorCode, message, error, requestId, timestamp, path }`.
- **OpenAPI Specs**: Exportable using `npm run export:openapi`.
