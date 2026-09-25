# API validation contracts

`api-contracts.json` is the repository-level source of truth for the API version, dispute status vocabulary, and request validation constraints that are enforced by both NestJS and the browser.

Backend DTO decorators and upload validation import the contract through `backend/src/common/api-contracts.ts`. Frontend Zod schemas and active forms import it through `frontend/lib/api-contracts.ts`. The checked-in `backend/src/contracts/api-contracts.json` and `frontend/contracts/api-contracts.json` files are generated copies; `build` and development scripts refresh them, and `npm run sync:contracts` can be run after editing the canonical file. Do not copy numeric limits or MIME allowlists into feature code.

Frontend schemas are user-experience checks only. NestJS `ValidationPipe`, DTOs, upload pipes, and server authorization remain authoritative. Form-only rules, such as a richer dispute description hint, stay in the frontend.
