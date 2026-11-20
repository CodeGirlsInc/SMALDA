/**
 * Multipart upload with real progress and cancellation (#1641).
 *
 * `fetch` cannot report upload progress, so this uses XMLHttpRequest and
 * `upload.onprogress`. The percentage is bytes sent over bytes total, capped at
 * 99 until the server has answered, so the bar never claims "done" early.
 */
export interface UploadHandle<T> {
  promise: Promise<T>;
  /** Aborts the request; the promise rejects with an `UploadAbortedError`. */
  abort: () => void;
}

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadAbortedError";
  }
}

export class UploadHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Upload failed with status ${status}`);
    this.name = "UploadHttpError";
  }
}

export function uploadWithProgress<T = unknown>(
  url: string,
  body: FormData,
  options: {
    token?: string | null;
    onProgress?: (percent: number) => void;
  } = {},
): UploadHandle<T> {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", url);
    xhr.withCredentials = true;
    if (options.token) {
      xhr.setRequestHeader("Authorization", `Bearer ${options.token}`);
    }

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (!event.lengthComputable || event.total === 0) return;
      const percent = Math.floor((event.loaded / event.total) * 100);
      options.onProgress?.(Math.min(percent, 99));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
        try {
          resolve((xhr.responseText ? JSON.parse(xhr.responseText) : undefined) as T);
        } catch {
          resolve(undefined as T);
        }
      } else {
        reject(new UploadHttpError(xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new UploadAbortedError());

    xhr.send(body);
  });

  return { promise, abort: () => xhr.abort() };
}
