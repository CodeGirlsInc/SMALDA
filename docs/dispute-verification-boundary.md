# Dispute / Verification module boundary

This document records the intended boundary between the dispute and
verification domains so future changes do not introduce a circular
dependency as the codebase grows.

## Rules

1. `DisputeModule` must not import `VerificationModule` (or inject its
   services). Disputes record decisions against their own tables
   (`disputes`, `dispute_reasons`) and report them through
   `AccessLogsService.logDocumentAccess`.
2. Verification state is written only by `VerificationService` against
   the `verification_records` table, and is read through the verify
   lookup endpoints or `VerificationService.find*` methods. Consumers
   never write into another module's tables.
3. Cross-domain reads either resolve through a shared read service
   (e.g. `VerificationController` already reads `DocumentsService`) or
   consume push events on the documents Socket.IO gateway — never by
   injecting one feature module's service into the other.
4. The only sanctioned module cycle today is `DocumentsModule` ↔
   `VerificationModule`, kept behind `forwardRef()` in both directions.
   No new cycles are allowed; prefer an event or a read-only query.