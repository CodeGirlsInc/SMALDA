import {
  clearAllSessionState,
  clearSessionState,
  commitSessionResume,
  commitSessionState,
  consumeSessionResume,
  consumeSessionState,
  preserveSessionState,
  readSessionState,
  type SessionStateResult,
} from "../session-state-preserver";

const values: Record<string, string> = {};
const accessTokens: Record<string, string> = {};
let blockGet = false;
let blockLocalGet = false;
let blockSetKey: string | null = null;
let blockRemove = false;

const sessionStorage = {
  getItem: jest.fn((key: string) => {
    if (blockGet) throw new DOMException("blocked", "SecurityError");
    return values[key] ?? null;
  }),
  setItem: jest.fn((key: string, value: string) => {
    if (blockSetKey === key) throw new DOMException("blocked", "SecurityError");
    values[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    if (blockRemove) throw new DOMException("blocked", "SecurityError");
    delete values[key];
  }),
  get length() {
    return Object.keys(values).length;
  },
  key: jest.fn((index: number) => Object.keys(values)[index] ?? null),
};

const localStorage = {
  getItem: jest.fn((key: string) => {
    if (blockLocalGet) throw new DOMException("blocked", "SecurityError");
    return accessTokens[key] ?? null;
  }),
  setItem: jest.fn((key: string, value: string) => {
    accessTokens[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete accessTokens[key];
  }),
};

function makeToken(subject: string, nonce = ""): string {
  const payload = btoa(JSON.stringify({ sub: subject, iat: nonce }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

function unwrap<T>(result: SessionStateResult<T>): T {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

beforeEach(() => {
  Object.keys(values).forEach((key) => delete values[key]);
  Object.keys(accessTokens).forEach((key) => delete accessTokens[key]);
  accessTokens["auth-token"] = makeToken("user-a", "old");
  blockGet = false;
  blockLocalGet = false;
  blockSetKey = null;
  blockRemove = false;
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: sessionStorage,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  sessionStorage.getItem.mockClear();
  sessionStorage.setItem.mockClear();
  sessionStorage.removeItem.mockClear();
  sessionStorage.key.mockClear();
  localStorage.getItem.mockClear();
  localStorage.setItem.mockClear();
  localStorage.removeItem.mockClear();
});

describe("transactional session state", () => {
  it("reads without removing and commits only after the caller is ready", () => {
    const resumeId = unwrap(
      preserveSessionState("upload-form", { fileName: "deed.pdf" }),
    );
    expect(resumeId).toEqual(expect.any(String));

    const read = readSessionState<{ fileName: string }>("upload-form");
    expect(unwrap(read)).toEqual({ fileName: "deed.pdf" });
    expect(sessionStorage.removeItem).not.toHaveBeenCalled();

    expect(commitSessionState("upload-form")).toEqual({ ok: true, value: undefined });
    expect(sessionStorage.removeItem).toHaveBeenCalledTimes(2);
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "not-found", key: "upload-form" },
    });
  });

  it("consumes a matching session exactly once", () => {
    unwrap(preserveSessionState("upload-form", { title: "Land deed" }));

    expect(unwrap(consumeSessionState("upload-form"))).toEqual({
      title: "Land deed",
    });
    expect(sessionStorage.removeItem).toHaveBeenCalledTimes(2);
    expect(consumeSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "not-found", key: "upload-form" },
    });
    expect(sessionStorage.removeItem).toHaveBeenCalledTimes(2);
  });

  it("consumes pending state transactionally on an explicit resume", () => {
    const resumeId = unwrap(
      preserveSessionState("upload-form", { title: "Land deed" }),
    );
    const newToken = makeToken("user-a", "new");
    accessTokens["auth-token"] = newToken;

    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "session-mismatch", key: "upload-form" },
    });
    expect(unwrap(consumeSessionResume(resumeId, newToken))).toEqual({
      "upload-form": { title: "Land deed" },
    });
    expect(values["smalda-session-state:upload-form"]).toBeUndefined();
    expect(values["smalda-session-state:__pending__"]).toBeUndefined();
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "not-found", key: "upload-form" },
    });
  });

  it("rejects a resume committed by a different JWT subject", () => {
    accessTokens["auth-token"] = makeToken("user-a");
    const resumeId = unwrap(
      preserveSessionState("upload-form", { title: "Land deed" }),
    );

    accessTokens["auth-token"] = makeToken("user-b");
    expect(commitSessionResume(resumeId, makeToken("user-b"))).toEqual({
      ok: false,
      error: { code: "session-mismatch", key: "upload-form" },
    });
    accessTokens["auth-token"] = makeToken("user-a");
    expect(unwrap(commitSessionResume(resumeId, makeToken("user-a")))).toBe(1);
    expect(values["smalda-session-state:upload-form"]).toBeUndefined();
    expect(values["smalda-session-state:__pending__"]).toBeUndefined();
  });

  it("does not preserve state for an unverifiable token", () => {
    accessTokens["auth-token"] = "opaque-old-token";

    expect(
      preserveSessionState("upload-form", { title: "Land deed" }),
    ).toEqual({
      ok: false,
      error: { code: "unauthenticated", key: "upload-form" },
    });
  });

  it("rejects a resume when the subject cannot be verified", () => {
    const resumeId = unwrap(
      preserveSessionState("upload-form", { title: "Land deed" }),
    );
    accessTokens["auth-token"] = "opaque-new-token";

    expect(commitSessionResume(resumeId, "opaque-new-token")).toEqual({
      ok: false,
      error: { code: "session-mismatch", key: "upload-form" },
    });
  });

  it("surfaces blocked reads and removal failures without losing state", () => {
    unwrap(preserveSessionState("upload-form", { title: "Land deed" }));
    blockGet = true;
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "storage", key: "smalda-session-state:upload-form" },
    });
    blockGet = false;

    blockLocalGet = true;
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "storage", key: "auth-token" },
    });
    blockLocalGet = false;

    blockRemove = true;
    expect(consumeSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "removal", key: "smalda-session-state:upload-form" },
    });
    blockRemove = false;
    expect(unwrap(readSessionState("upload-form"))).toEqual({
      title: "Land deed",
    });
  });

  it("does not claim resume success when state removal fails", () => {
    const resumeId = unwrap(
      preserveSessionState("upload-form", { title: "Land deed" }),
    );
    const newToken = makeToken("user-a", "new");
    accessTokens["auth-token"] = newToken;
    blockRemove = true;

    expect(consumeSessionResume(resumeId, newToken)).toEqual({
      ok: false,
      error: { code: "removal", key: "smalda-session-state:upload-form" },
    });

    blockRemove = false;
    expect(values["smalda-session-state:upload-form"]).toBeDefined();
    expect(values["smalda-session-state:__pending__"]).toBeDefined();
  });

  it("rolls back a state write when the pending index cannot be written", () => {
    blockSetKey = "smalda-session-state:__pending__";
    expect(preserveSessionState("upload-form", { title: "Land deed" })).toEqual({
      ok: false,
      error: { code: "storage", key: "smalda-session-state:__pending__" },
    });
    blockSetKey = null;
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "not-found", key: "upload-form" },
    });
  });

  it("rejects File and Blob values instead of silently losing their bytes", () => {
    expect(
      preserveSessionState("upload", new File(["data"], "deed.pdf")),
    ).toEqual({
      ok: false,
      error: { code: "serialization", key: "upload" },
    });
    expect(preserveSessionState("upload", new Blob(["data"]))).toEqual({
      ok: false,
      error: { code: "serialization", key: "upload" },
    });
  });

  it("clears all preserved entries for an explicit logout", () => {
    unwrap(preserveSessionState("first", { value: 1 }));
    unwrap(preserveSessionState("second", { value: 2 }));

    expect(clearAllSessionState()).toEqual({ ok: true, value: undefined });
    expect(readSessionState("first")).toEqual({
      ok: false,
      error: { code: "not-found", key: "first" },
    });
    expect(readSessionState("second")).toEqual({
      ok: false,
      error: { code: "not-found", key: "second" },
    });
  });

  it("can explicitly clear a single entry", () => {
    unwrap(preserveSessionState("upload-form", { title: "Land deed" }));
    expect(clearSessionState("upload-form")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(readSessionState("upload-form")).toEqual({
      ok: false,
      error: { code: "not-found", key: "upload-form" },
    });
  });
});
