export const LAST_VIEWED_PARCEL_KEY = "smalda:last-viewed-parcel";

const USER_KEY_PREFIX = `${LAST_VIEWED_PARCEL_KEY}:`;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getUserKey(userId: string): string | null {
  if (!userId || userId.length > 200) return null;
  return `${USER_KEY_PREFIX}${userId}`;
}

export function readLastViewedParcelId(userId?: string): string | null {
  const storage = getStorage();
  const key = getUserKey(userId);
  if (!storage || !key) return null;

  try {
    const value = storage.getItem(key);
    if (!value || value.length > 200) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveLastViewedParcelId(id: string, userId?: string): void {
  const storage = getStorage();
  const key = getUserKey(userId);
  if (!storage || !key || !id || id.length > 200) return;

  try {
    storage.setItem(key, id);
  } catch {
    return;
  }
}

export function clearLastViewedParcel(userId?: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (userId) {
      const key = getUserKey(userId);
      if (key) storage.removeItem(key);
      return;
    }

    storage.removeItem(LAST_VIEWED_PARCEL_KEY);
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(USER_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    return;
  }
}
