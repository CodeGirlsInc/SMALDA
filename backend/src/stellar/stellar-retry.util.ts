/**
 * Retry helpers for transient Horizon failures.
 *
 * Only transient failures (rate limits, 5xx responses, timeouts, connection
 * resets, bad sequence numbers, insufficient fees) are retried. Permanent
 * transaction failures such as `op_underfunded` must fail immediately so they
 * do not burn attempts or trip the circuit breaker.
 */

export type StellarErrorCategory = 'retryable' | 'permanent' | 'unknown';

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const RETRYABLE_RESULT_CODES = new Set([
  'tx_bad_seq',
  'tx_too_late',
  'tx_insufficient_fee',
]);

const PERMANENT_RESULT_CODES = new Set([
  'op_underfunded',
  'op_low_reserve',
  'op_no_destination',
  'op_no_trust',
  'op_not_authorized',
  'op_bad_auth',
  'op_invalid_limit',
  'tx_bad_auth',
  'tx_bad_auth_extra',
  'tx_insufficient_balance',
  'tx_failed',
  'tx_no_account',
  'tx_bad_tx',
  'tx_malformed',
  'tx_too_early',
]);

const RETRYABLE_MESSAGE_PATTERN =
  /timeout|timed out|etimedout|enotfound|econnreset|econnrefused|socket hang up|network error|fetch failed|temporar|transient|rate limit/i;

interface HorizonLikeError {
  code?: string;
  status?: number;
  resultCodes?: { transaction?: string; operations?: string[] };
  response?: {
    status?: number;
    data?: {
      code?: string;
      status?: number;
      result_codes?: { transaction?: string; operations?: string[] };
      title?: string;
      detail?: string;
    };
  };
  message?: string;
}

function asHorizonError(error: unknown): HorizonLikeError {
  return (error ?? {}) as HorizonLikeError;
}

function collectResultCodes(error: HorizonLikeError): string[] {
  const codes: string[] = [];
  if (error.code) codes.push(error.code);
  if (error.resultCodes?.transaction) codes.push(error.resultCodes.transaction);
  if (error.resultCodes?.operations) codes.push(...error.resultCodes.operations);
  if (error.response?.data?.code) codes.push(error.response.data.code);
  if (error.response?.data?.result_codes?.transaction) {
    codes.push(error.response.data.result_codes.transaction);
  }
  if (error.response?.data?.result_codes?.operations) {
    codes.push(...error.response.data.result_codes.operations);
  }
  return codes;
}

/** Classify a Horizon/Stellar error so callers can retry or fail fast. */
export function classifyStellarError(error: unknown): StellarErrorCategory {
  const horizonError = asHorizonError(error);
  const status = horizonError.response?.status ?? horizonError.response?.data?.status ?? horizonError.status;

  const codes = collectResultCodes(horizonError);
  if (codes.some((code) => PERMANENT_RESULT_CODES.has(code))) return 'permanent';
  if (codes.some((code) => RETRYABLE_RESULT_CODES.has(code))) return 'retryable';

  if (status !== undefined) {
    if (RETRYABLE_HTTP_STATUSES.has(status)) return 'retryable';
    // Other 4xx responses are permanent request/transaction failures.
    if (status >= 400 && status < 500) return 'permanent';
  }

  const message = [horizonError.message, horizonError.response?.data?.detail]
    .filter(Boolean)
    .join(' ');
  if (RETRYABLE_MESSAGE_PATTERN.test(message)) return 'retryable';

  return 'unknown';
}

export function isRetryableStellarError(error: unknown): boolean {
  return classifyStellarError(error) === 'retryable';
}

export function isPermanentStellarError(error: unknown): boolean {
  return classifyStellarError(error) === 'permanent';
}

export type ShouldRetryStellar = (error: unknown) => boolean;

/**
 * Retry wrapper with exponential backoff for transient Horizon API failures.
 * Permanent errors are rethrown immediately.
 */
export async function withStellarRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 200,
  shouldRetry: ShouldRetryStellar = isRetryableStellarError,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)),
      );
    }
  }

  throw lastError;
}
