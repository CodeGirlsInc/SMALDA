# Anchoring capacity and key scheme

## The limit

Every anchor (`doc_<hash>`), transfer (`trf_...`) and revocation (`revoked_<hash>`) is a
`ManageData` entry on **one** account derived from `STELLAR_SECRET_KEY`. Each entry is a
subentry of that account. Stellar caps an account at **1,000 subentries**, and each subentry
raises the minimum balance by **0.5 XLM** (`(2 + subentries) * 0.5`). Past either limit every
submit fails (`op_too_many_subentries`, `op_low_reserve`).

## What is in place (this change)

- `StellarClient::account_capacity` reads `subentry_count` and the native balance.
- `GET /v1/health/ready` includes `anchor_account` (`subentry_count`, `subentry_limit`,
  `balance_xlm`, `min_balance_xlm`, `reserve_headroom_xlm`, `subentry_usage_percent`) and logs a
  warning at 80% of the cap or under 5 XLM of reserve headroom. Alert on those fields.
- Transfers and revocations no longer overwrite each other:
  - transfer key: `trf_<doc[..24]>_<transfer_hash[..29]>` (one entry per transfer, listable per
    document by prefix), value = the transfer hash;
  - revocation value: `<unix_ts>|<32 hex of SHA-256 over the revocation record>` (never
    truncated; the full record goes to the audit log and webhook).
- `get_hash_history` follows Horizon's `_links.next` (200 operations per page, at most 50 pages)
  and stops at the document's own anchor entry.

## Chosen long-term scheme (not implemented here)

Entries still consume subentries, so the real fix is to stop using persistent data entries for
anchors: anchor with the transaction **memo** (`MEMO_HASH` = document or transfer hash) and look
anchors up through Horizon transaction history, which does not consume subentries. Rotating
across several anchor accounts is the fallback. Until then the numbers above are the guard.

## Limits of on-chain history

Owners are not stored on-chain, only transfer hashes. The transfer *order and existence* can be
verified from the chain, but the full ownership chain (`from_owner`/`to_owner`) cannot be rebuilt
from it when Redis is lost.
