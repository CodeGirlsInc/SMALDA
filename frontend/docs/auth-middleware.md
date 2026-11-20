# Auth middleware

## API base URL (#1653)

`middleware.ts` builds the `/auth/me` URL with `apiUrl("/auth/me")` from `lib/api-config.ts`,
which normalises `NEXT_PUBLIC_API_URL` whether it is the bare origin, ends in `/api`, or ends in
`/api/v1`. It no longer re-derives the base itself, so all three forms resolve to the same
`<origin>/api/v1/auth/me`. This was already the case on `main` when the issue was triaged;
`test-utils/api-config.test.ts` covers the three forms.

## Round-trips and failures (#1654)

- Positive `/auth/me` results are cached per access token for 30 seconds per edge isolate, so
  navigating between protected pages (and prefetches) does not call the API each time.
- If the API is slow or failing, admin routes still return 503 (the role is needed); other
  protected pages are let through, because the page's own API calls reject an invalid token.
- Not done: verifying the JWT signature locally with `jose`. That needs a new dependency and a
  verification key or shared secret exposed to the edge runtime.
