import { UploadAbortedError, UploadHttpError, uploadWithProgress } from "../upload-xhr";

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = "";
  withCredentials = false;
  headers: Record<string, string> = {};
  method = "";
  url = "";
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {}
  abort() {
    this.onabort?.();
  }
}

describe("uploadWithProgress", () => {
  const original = global.XMLHttpRequest;
  beforeEach(() => {
    (global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
  });
  afterEach(() => {
    global.XMLHttpRequest = original;
  });

  it("reports bytes sent, capped at 99 until the server answers", async () => {
    const seen: number[] = [];
    const { promise } = uploadWithProgress("/u", new FormData(), {
      onProgress: (p) => seen.push(p),
      token: "tok",
    });
    const xhr = FakeXhr.last;
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.headers.Authorization).toBe("Bearer tok");

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    xhr.status = 202;
    xhr.responseText = '{"id":"d1"}';
    xhr.onload?.();

    await expect(promise).resolves.toEqual({ id: "d1" });
    expect(seen).toEqual([25, 99, 100]);
  });

  it("rejects with the status on a non-2xx response", async () => {
    const { promise } = uploadWithProgress("/u", new FormData());
    FakeXhr.last.status = 413;
    FakeXhr.last.onload?.();
    await expect(promise).rejects.toBeInstanceOf(UploadHttpError);
  });

  it("abort() cancels the request", async () => {
    const { promise, abort } = uploadWithProgress("/u", new FormData());
    abort();
    await expect(promise).rejects.toBeInstanceOf(UploadAbortedError);
  });
});
