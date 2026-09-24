/**
 * Measures document processing job duration alongside the existing
 * pass/fail metrics, so performance regressions become detectable.
 */
export async function withDurationMetric<T>(
  jobName: string,
  operation: () => Promise<T>,
  recordDuration: (jobName: string, durationMs: number) => void,
): Promise<T> {
  const start = Date.now();
  try {
    return await operation();
  } finally {
    recordDuration(jobName, Date.now() - start);
  }
}
