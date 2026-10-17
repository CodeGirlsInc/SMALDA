/**
 * Auth API calls (#1507).
 *
 * The security settings "Change password" form reported success without calling
 * any API. This provides the missing call so the UI reflects the real result.
 */
import { apiUrl } from "./api-version";

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(
  payload: ChangePasswordPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(apiUrl("/auth/change-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to change password (${response.status})`);
  }
}
