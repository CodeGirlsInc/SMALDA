/**
 * Security settings API (#1508, #1509, #1510).
 *
 * The security settings page used hard-coded mock sessions, a local-only
 * "Revoke", a 2FA toggle that only flipped local state, and "Delete account"
 * that signed the user out without deleting anything. These calls back each
 * action with the real API.
 */
import { apiUrl } from "./api-version";

export interface SessionInfo {
  id: string;
  device?: string;
  lastActive?: string;
}

async function expectOk(
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const response = await fetchImpl(apiUrl(path), {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status})`);
  }
  return response;
}

export async function listSessions(
  fetchImpl: typeof fetch = fetch,
): Promise<SessionInfo[]> {
  const response = await expectOk("/auth/sessions", {}, fetchImpl);
  return (await response.json()) as SessionInfo[];
}

export async function revokeSession(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await expectOk(`/auth/sessions/${id}`, { method: "DELETE" }, fetchImpl);
}

export async function setTwoFactor(
  enabled: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await expectOk(
    "/auth/2fa",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
    fetchImpl,
  );
}

export async function deleteAccount(
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await expectOk("/auth/account", { method: "DELETE" }, fetchImpl);
}
