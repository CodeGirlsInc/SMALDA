/**
 * Transactional storage for JSON-only form state across an authentication
 * redirect. State is bound to the current access token and to a one-time
 * resume group; a resume commit requires JWT `sub` claims and verifies that
 * the replacement token belongs to the same subject. Use
 * readSessionState followed by commitSessionState when a value can fail while
 * it is being applied; consumeSessionResume returns restored values while
 * removing the pending group transactionally. restoreSessionState is the
 * one-shot consume variant.
 *
 * File and Blob instances are intentionally rejected because JSON does not
 * preserve their bytes. Preserve metadata such as a file name and obtain the
 * original file again through the upload flow.
 */

const SESSION_STATE_PREFIX = "smalda-session-state:";
const PENDING_RESUMES_KEY = `${SESSION_STATE_PREFIX}__pending__`;
const ACCESS_TOKEN_KEY = "auth-token";
const STORAGE_VERSION = 1;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SessionStateErrorCode =
  | "invalid-key"
  | "unavailable"
  | "unauthenticated"
  | "not-found"
  | "serialization"
  | "storage"
  | "parse"
  | "session-mismatch"
  | "resume-not-found"
  | "removal";

export interface SessionStateError {
  code: SessionStateErrorCode;
  key?: string;
}

export type SessionStateResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SessionStateError };

interface StoredSessionState {
  version: typeof STORAGE_VERSION;
  key: string;
  resumeId: string;
  sessionId: string;
  subject: string | null;
  state: JsonValue;
}

interface PendingResume {
  resumeId: string;
  keys: string[];
}

interface StorageWrite {
  key: string;
  value: string | null;
}

function failure<T>(
  code: SessionStateErrorCode,
  key?: string,
): SessionStateResult<T> {
  return { ok: false, error: key ? { code, key } : { code } };
}

function propagateFailure<T>(
  result: { ok: false; error: SessionStateError },
): SessionStateResult<T> {
  return result;
}

function getStateKey(key: string): string {
  return `${SESSION_STATE_PREFIX}${key}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readAccessToken(): SessionStateResult<string | null> {
  if (typeof window === "undefined") return failure("unavailable");
  try {
    return { ok: true, value: window.localStorage.getItem(ACCESS_TOKEN_KEY) };
  } catch {
    return failure("storage", ACCESS_TOKEN_KEY);
  }
}

function readItem(
  storage: Storage,
  key: string,
): SessionStateResult<string | null> {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return failure("storage", key);
  }
}

function writeItem(
  storage: Storage,
  key: string,
  value: string,
): SessionStateResult<void> {
  try {
    storage.setItem(key, value);
    return { ok: true, value: undefined };
  } catch {
    return failure("storage", key);
  }
}

function removeItem(
  storage: Storage,
  key: string,
): SessionStateResult<void> {
  try {
    storage.removeItem(key);
    return { ok: true, value: undefined };
  } catch {
    return failure("removal", key);
  }
}

function restoreItem(
  storage: Storage,
  key: string,
  previousValue: string | null,
): void {
  try {
    if (previousValue === null) storage.removeItem(key);
    else storage.setItem(key, previousValue);
  } catch {
    // Rollback is best effort; the original failure is returned to the caller.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;

  try {
    const prototype = Object.getPrototypeOf(value);
    if (
      !Array.isArray(value) &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      return false;
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      return value.every((item) => isJsonValue(item, ancestors));
    }
    return Object.values(value).every((item) => isJsonValue(item, ancestors));
  } catch {
    return false;
  } finally {
    ancestors.delete(value);
  }
}

function serializeJson(value: unknown): SessionStateResult<string> {
  try {
    if (!isJsonValue(value)) return failure("serialization");
    const serialized = JSON.stringify(value);
    return serialized === undefined
      ? failure("serialization")
      : { ok: true, value: serialized };
  } catch {
    return failure("serialization");
  }
}

function parseStoredState(
  raw: string,
  key: string,
): SessionStateResult<StoredSessionState> {
  try {
    const parsed: unknown = JSON.parse(raw);
    const subject = isRecord(parsed) ? parsed.subject : undefined;
    if (
      !isRecord(parsed) ||
      parsed.version !== STORAGE_VERSION ||
      parsed.key !== key ||
      typeof parsed.resumeId !== "string" ||
      parsed.resumeId.length === 0 ||
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.length === 0 ||
      (subject !== null && typeof subject !== "string") ||
      !isJsonValue(parsed.state)
    ) {
      return failure("parse", getStateKey(key));
    }
    return {
      ok: true,
      value: {
        version: STORAGE_VERSION,
        key,
        resumeId: parsed.resumeId,
        sessionId: parsed.sessionId,
        subject: subject as string | null,
        state: parsed.state as JsonValue,
      },
    };
  } catch {
    return failure("parse", getStateKey(key));
  }
}

function parsePendingResume(
  raw: string | null,
): SessionStateResult<PendingResume | null> {
  if (raw === null) return { ok: true, value: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.resumeId !== "string" ||
      parsed.resumeId.length === 0 ||
      !Array.isArray(parsed.keys) ||
      !parsed.keys.every((key) => typeof key === "string" && key.length > 0)
    ) {
      return failure("parse", PENDING_RESUMES_KEY);
    }
    const keys = parsed.keys.filter(
      (key: unknown): key is string =>
        typeof key === "string" && key.length > 0,
    );
    return {
      ok: true,
      value: { resumeId: parsed.resumeId, keys: [...new Set(keys)] },
    };
  } catch {
    return failure("parse", PENDING_RESUMES_KEY);
  }
}

function readPendingResume(
  storage: Storage,
): SessionStateResult<PendingResume | null> {
  const raw = readItem(storage, PENDING_RESUMES_KEY);
  return raw.ok ? parsePendingResume(raw.value) : propagateFailure(raw);
}

function serializePendingResume(
  pending: PendingResume | null,
): SessionStateResult<string | null> {
  if (pending === null) return { ok: true, value: null };
  const serialized = serializeJson(pending);
  return serialized.ok ? serialized : propagateFailure(serialized);
}

function applyWrites(
  storage: Storage,
  writes: StorageWrite[],
): SessionStateResult<void> {
  const previous: string | null[] = [];
  for (const write of writes) {
    const current = readItem(storage, write.key);
    if (!current.ok) return propagateFailure(current);
    previous.push(current.value);
  }

  for (let index = 0; index < writes.length; index += 1) {
    const write = writes[index];
    const result =
      write.value === null
        ? removeItem(storage, write.key)
        : writeItem(storage, write.key, write.value);
    if (!result.ok) {
      for (
        let rollbackIndex = 0;
        rollbackIndex < writes.length;
        rollbackIndex += 1
      ) {
        restoreItem(storage, writes[rollbackIndex].key, previous[rollbackIndex]);
      }
      return propagateFailure(result);
    }
  }
  return { ok: true, value: undefined };
}

function createResumeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getAccessTokenFingerprint(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `token-${(hash >>> 0).toString(16)}`;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4)) % 4;
    const binary = atob(normalized + "=".repeat(padding));
    if (typeof TextDecoder === "undefined") return binary;
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function getTokenSubject(token: string): string | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) return null;
  try {
    const payload: unknown = JSON.parse(decoded);
    if (
      typeof payload === "object" &&
      payload !== null &&
      "sub" in payload &&
      typeof payload.sub === "string" &&
      payload.sub.length > 0
    ) {
      return payload.sub;
    }
  } catch {
    return null;
  }
  return null;
}

function getCurrentSessionIdResult(): SessionStateResult<string | null> {
  const token = readAccessToken();
  if (!token.ok) return propagateFailure(token);
  return {
    ok: true,
    value: token.value ? getAccessTokenFingerprint(token.value) : null,
  };
}

export function getCurrentSessionId(): SessionStateResult<string | null> {
  return getCurrentSessionIdResult();
}

function resolveSessionId(
  sessionId: string | null | undefined,
): SessionStateResult<string | null> {
  return sessionId === undefined
    ? getCurrentSessionId()
    : { ok: true, value: sessionId };
}

export function getPendingSessionResumeId(): SessionStateResult<string | null> {
  const storage = getStorage();
  if (!storage) return failure("unavailable");
  const pending = readPendingResume(storage);
  return pending.ok
    ? { ok: true, value: pending.value?.resumeId ?? null }
    : propagateFailure(pending);
}

export function preserveSessionState<T>(
  key: string,
  state: T,
): SessionStateResult<string> {
  if (!key || key === "__pending__") return failure("invalid-key", key);
  const storage = getStorage();
  if (!storage) return failure("unavailable", key);
  const tokenResult = readAccessToken();
  if (!tokenResult.ok) return propagateFailure(tokenResult);
  if (!tokenResult.value) return failure("unauthenticated", key);
  const token = tokenResult.value;
  const subject = getTokenSubject(token);
  if (!subject) return failure("unauthenticated", key);

  const serializedState = serializeJson(state);
  if (!serializedState.ok) return failure("serialization", key);
  let stateValue: JsonValue;
  try {
    stateValue = JSON.parse(serializedState.value) as JsonValue;
  } catch {
    return failure("serialization", key);
  }

  const pending = readPendingResume(storage);
  if (!pending.ok) return propagateFailure(pending);
  const resumeId = pending.value?.resumeId ?? createResumeId();
  const keys = [...new Set([...(pending.value?.keys ?? []), key])];
  const stored: StoredSessionState = {
    version: STORAGE_VERSION,
    key,
    resumeId,
    sessionId: getAccessTokenFingerprint(token),
    subject,
    state: stateValue,
  };
  const serializedStored = serializeJson(stored);
  const serializedPending = serializePendingResume({
    resumeId,
    keys,
  });
  if (!serializedStored.ok) return failure("serialization", key);
  if (!serializedPending.ok) return failure("serialization", PENDING_RESUMES_KEY);

  const committed = applyWrites(storage, [
    { key: getStateKey(key), value: serializedStored.value },
    { key: PENDING_RESUMES_KEY, value: serializedPending.value },
  ]);
  return committed.ok
    ? { ok: true, value: resumeId }
    : propagateFailure(committed);
}

export type ResumedSessionState = Record<string, JsonValue>;

export function consumeSessionResume(
  resumeId: string,
  accessToken: string,
): SessionStateResult<ResumedSessionState> {
  if (!resumeId || !accessToken) return failure("resume-not-found", resumeId);
  const storage = getStorage();
  if (!storage) return failure("unavailable", resumeId);
  const pending = readPendingResume(storage);
  if (!pending.ok) return propagateFailure(pending);
  if (!pending.value || pending.value.resumeId !== resumeId) {
    return failure("resume-not-found", resumeId);
  }

  const sessionId = getAccessTokenFingerprint(accessToken);
  const currentSessionId = getCurrentSessionIdResult();
  if (!currentSessionId.ok) return propagateFailure(currentSessionId);
  if (currentSessionId.value !== sessionId) {
    return failure("session-mismatch", resumeId);
  }
  const resumedState: ResumedSessionState = Object.create(null) as ResumedSessionState;
  const writes: StorageWrite[] = [];
  for (const key of pending.value.keys) {
    const raw = readItem(storage, getStateKey(key));
    if (!raw.ok) return propagateFailure(raw);
    if (raw.value === null) return failure("not-found", key);
    const parsed = parseStoredState(raw.value, key);
    if (!parsed.ok) return propagateFailure(parsed);
    if (parsed.value.resumeId !== resumeId) return failure("parse", key);
    const nextSubject = getTokenSubject(accessToken);
    if (parsed.value.subject === null || nextSubject === null) {
      return failure("session-mismatch", key);
    }
    if (parsed.value.subject !== nextSubject) {
      return failure("session-mismatch", key);
    }
    resumedState[key] = parsed.value.state;
    writes.push({ key: getStateKey(key), value: null });
  }
  writes.push({ key: PENDING_RESUMES_KEY, value: null });
  const committed = applyWrites(storage, writes);
  return committed.ok
    ? { ok: true, value: resumedState }
    : propagateFailure(committed);
}

export function commitSessionResume(
  resumeId: string,
  accessToken: string,
): SessionStateResult<number> {
  const consumed = consumeSessionResume(resumeId, accessToken);
  return consumed.ok
    ? { ok: true, value: Object.keys(consumed.value).length }
    : propagateFailure(consumed);
}

export function readSessionState<T>(
  key: string,
  sessionId?: string | null,
): SessionStateResult<T> {
  if (!key) return failure("invalid-key", key);
  const resolvedSessionId = resolveSessionId(sessionId);
  if (!resolvedSessionId.ok) return propagateFailure(resolvedSessionId);
  if (!resolvedSessionId.value) return failure("unauthenticated", key);
  const storage = getStorage();
  if (!storage) return failure("unavailable", key);
  const raw = readItem(storage, getStateKey(key));
  if (!raw.ok) return propagateFailure(raw);
  if (raw.value === null) return failure("not-found", key);
  const parsed = parseStoredState(raw.value, key);
  if (!parsed.ok) return propagateFailure(parsed);
  if (parsed.value.sessionId !== resolvedSessionId.value) {
    return failure("session-mismatch", key);
  }
  return { ok: true, value: parsed.value.state as T };
}

function pendingWithoutKey(
  pending: PendingResume | null,
  key: string,
): PendingResume | null {
  if (!pending || !pending.keys.includes(key)) return pending;
  const keys = pending.keys.filter((pendingKey) => pendingKey !== key);
  return keys.length === 0 ? null : { ...pending, keys };
}

export function commitSessionState(
  key: string,
  sessionId?: string | null,
): SessionStateResult<void> {
  const read = readSessionState<JsonValue>(key, sessionId);
  if (!read.ok) return propagateFailure(read);
  const storage = getStorage();
  if (!storage) return failure("unavailable", key);
  const raw = readItem(storage, getStateKey(key));
  if (!raw.ok) return propagateFailure(raw);
  if (raw.value === null) return failure("not-found", key);
  const parsed = parseStoredState(raw.value, key);
  if (!parsed.ok) return propagateFailure(parsed);
  const pending = readPendingResume(storage);
  if (!pending.ok) return propagateFailure(pending);
  const nextPending = pendingWithoutKey(pending.value, key);
  const serializedPending = serializePendingResume(nextPending);
  if (!serializedPending.ok) return propagateFailure(serializedPending);
  const writes: StorageWrite[] = [
    { key: getStateKey(key), value: null },
  ];
  if (nextPending !== pending.value) {
    writes.push({ key: PENDING_RESUMES_KEY, value: serializedPending.value });
  }
  const committed = applyWrites(storage, writes);
  return committed.ok ? committed : propagateFailure(committed);
}

export function consumeSessionState<T>(
  key: string,
  sessionId?: string | null,
): SessionStateResult<T> {
  const read = readSessionState<T>(key, sessionId);
  if (!read.ok) return read;
  const committed = commitSessionState(key, sessionId);
  return committed.ok
    ? { ok: true, value: read.value }
    : propagateFailure(committed);
}

export function restoreSessionState<T>(
  key: string,
  sessionId?: string | null,
): SessionStateResult<T> {
  return consumeSessionState<T>(key, sessionId);
}

export function clearSessionState(
  key: string,
  sessionId?: string | null,
): SessionStateResult<void> {
  if (!key) return failure("invalid-key", key);
  const storage = getStorage();
  if (!storage) return failure("unavailable", key);
  const raw = readItem(storage, getStateKey(key));
  if (!raw.ok) return propagateFailure(raw);
  if (raw.value !== null && sessionId !== undefined) {
    if (!sessionId) return failure("unauthenticated", key);
    const parsed = parseStoredState(raw.value, key);
    if (!parsed.ok) return propagateFailure(parsed);
    if (parsed.value.sessionId !== sessionId) {
      return failure("session-mismatch", key);
    }
  }

  const pending = readPendingResume(storage);
  if (!pending.ok) return propagateFailure(pending);
  const nextPending = pendingWithoutKey(pending.value, key);
  const serializedPending = serializePendingResume(nextPending);
  if (!serializedPending.ok) return propagateFailure(serializedPending);
  const writes: StorageWrite[] = [];
  if (raw.value !== null) writes.push({ key: getStateKey(key), value: null });
  if (nextPending !== pending.value) {
    writes.push({ key: PENDING_RESUMES_KEY, value: serializedPending.value });
  }
  return writes.length === 0
    ? { ok: true, value: undefined }
    : applyWrites(storage, writes);
}

export function clearAllSessionState(): SessionStateResult<void> {
  const storage = getStorage();
  if (!storage) return failure("unavailable");
  let length: number;
  try {
    length = storage.length;
  } catch {
    return failure("storage");
  }
  const keys = new Set<string>();
  try {
    for (let index = 0; index < length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(SESSION_STATE_PREFIX)) keys.add(key);
    }
  } catch {
    return failure("storage");
  }
  return applyWrites(
    storage,
    [...keys].map((key) => ({ key, value: null })),
  );
}
