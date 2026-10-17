/**
 * Profile and admin activity loaders (#1506, #1505, #1504).
 *
 * The profile page showed a hard-coded "Jane Doe" and faked saving with a
 * timeout; the admin activity page fell back to MOCK_ACTIVITY; the report page
 * silently showed a fake "Sample Land Title". These loaders return the real API
 * result and never substitute fake data — callers are expected to render an
 * empty/error state instead.
 */
import { apiUrl } from "./api-version";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export async function loadProfile(
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfile | null> {
  const response = await fetchImpl(apiUrl("/users/me"), {
    credentials: "include",
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load profile (${response.status})`);
  }
  return (await response.json()) as UserProfile;
}

export async function loadAdminActivity<T>(
  fetchImpl: typeof fetch = fetch,
): Promise<T[]> {
  const response = await fetchImpl(apiUrl("/admin/activity"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load activity (${response.status})`);
  }
  return (await response.json()) as T[];
}

export async function loadReport<T>(
  reportId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T | null> {
  const response = await fetchImpl(apiUrl(`/reports/${reportId}`), {
    credentials: "include",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load report (${response.status})`);
  }
  return (await response.json()) as T;
}
