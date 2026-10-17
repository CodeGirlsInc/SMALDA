# Webhook events

`webhook::dispatch` is called from the live handlers in `lib.rs` for every
state-changing or lookup operation, so integrators receive the same kind of
event for each of them (issue #1394):

| Event | Emitted by | Payload fields |
|---|---|---|
| `submit` | `POST /submit` | `document_hash`, `transaction_id` |
| `verify` | `POST /verify` | `document_hash`, `verified` |
| `transfer` | `POST /transfer` | `document_hash`, `transfer_hash` |
| `revoke` | `POST /revoke` | see `revoke_document` |

Deliveries go to every URL in `WEBHOOK_URLS` and are signed with
`WEBHOOK_SECRET` (see `webhook::sign_body`).

Note: `handlers/transfer.rs` holds an older, unrouted copy of the transfer
handler that does not emit the event; the routed handler in `lib.rs` does.
