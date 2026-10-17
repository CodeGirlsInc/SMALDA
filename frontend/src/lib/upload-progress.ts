/**
 * Upload progress tracking that cleans up after itself (#1511).
 *
 * The upload page faked progress and leaked its `setInterval` on errors. This
 * tracker owns its timer and guarantees it is cleared on completion or failure.
 */
export interface ProgressTracker {
  set(value: number): void;
  done(): void;
  fail(): void;
}

export function createProgressTracker(
  onProgress: (value: number) => void,
  intervalMs = 250,
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setInterval> =
    setInterval,
  clear: (handle: ReturnType<typeof setInterval>) => void = clearInterval,
): ProgressTracker {
  let value = 0;
  let handle: ReturnType<typeof setInterval> | null = schedule(() => {
    value = Math.min(value + 5, 95);
    onProgress(value);
  }, intervalMs);

  const stop = (): void => {
    if (handle !== null) {
      clear(handle);
      handle = null;
    }
  };

  return {
    set(next: number): void {
      value = Math.min(Math.max(next, 0), 100);
      onProgress(value);
    },
    done(): void {
      stop();
      onProgress(100);
    },
    fail(): void {
      stop();
    },
  };
}
