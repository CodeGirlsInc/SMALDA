import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { correlationIdStorage } from '../common/correlation/correlation-id.storage';
import {
  isRetryableStellarError,
  withStellarRetry,
} from './stellar-retry.util';

export interface VerifierSubmitRequest {
  documentHash: string;
  documentId: string;
  submitter: string;
}

export interface VerifierSubmitResponse {
  success: boolean;
  transaction_id?: string | null;
  anchored_at?: number | null;
  error?: string | null;
}

export interface VerifierVerifyResponse {
  verified: boolean;
  transaction_id?: string | null;
  timestamp?: number | null;
  cached?: boolean;
  revoked?: boolean | null;
  revoked_at?: number | null;
}

export interface VerifierRevokeRequest {
  documentHash: string;
  reason: string;
  revokedBy: string;
}

export interface VerifierRevokeResponse {
  transaction_id: string;
  revoked_at: number;
  revoked: boolean;
}

/**
 * Thin HTTP client for the Rust stellar-doc-verifier. It is only used when
 * VERIFIER_URL (or the legacy STELLAR_VERIFIER_URL) is configured; otherwise
 * the backend keeps its existing stellar-sdk anchoring path.
 */
@Injectable()
export class VerifierClient {
  private readonly logger = new Logger(VerifierClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const configured = (
      this.configService.get<string>('VERIFIER_URL') ||
      this.configService.get<string>('STELLAR_VERIFIER_URL') ||
      ''
    ).trim();

    const normalized = configured.replace(/\/+$/, '');
    this.baseUrl =
      normalized && !/\/v1$/i.test(normalized) ? `${normalized}/v1` : normalized;
    this.timeoutMs = Number(
      this.configService.get<number>('VERIFIER_TIMEOUT_MS', 10_000),
    ) || 10_000;
    this.maxRetries =
      Number(this.configService.get<number>('VERIFIER_MAX_RETRIES', 3)) || 3;
    this.http = axios.create({ timeout: this.timeoutMs });
  }

  get isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  private requestId(explicit?: string): string {
    return explicit || correlationIdStorage.getStore() || randomUUID();
  }

  private async request<T>(
    method: 'get' | 'post',
    path: string,
    body?: Record<string, unknown>,
    requestId?: string,
  ): Promise<T> {
    const id = this.requestId(requestId);
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await withStellarRetry(
        () =>
          method === 'get'
            ? this.http.get<T>(url, { headers: { 'x-request-id': id } })
            : this.http.post<T>(url, body, { headers: { 'x-request-id': id } }),
        this.maxRetries,
        200,
        isRetryableStellarError,
      );
      return response.data;
    } catch (error) {
      this.logger.warn(
        `Verifier ${method.toUpperCase()} ${path} failed (request ${id}): ${error?.message}`,
      );
      throw new ServiceUnavailableException(
        'Stellar document verifier is unavailable',
      );
    }
  }

  async submit(
    request: VerifierSubmitRequest,
    requestId?: string,
  ): Promise<VerifierSubmitResponse> {
    return this.request<VerifierSubmitResponse>(
      'post',
      '/submit',
      {
        document_hash: request.documentHash,
        document_id: request.documentId,
        submitter: request.submitter,
      },
      requestId,
    );
  }

  async verify(
    documentHash: string,
    transactionId?: string | null,
    requestId?: string,
  ): Promise<VerifierVerifyResponse> {
    return this.request<VerifierVerifyResponse>(
      'post',
      '/verify',
      {
        document_hash: documentHash,
        transaction_id: transactionId ?? null,
      },
      requestId,
    );
  }

  async revoke(
    request: VerifierRevokeRequest,
    requestId?: string,
  ): Promise<VerifierRevokeResponse> {
    return this.request<VerifierRevokeResponse>(
      'post',
      '/revoke',
      {
        document_hash: request.documentHash,
        reason: request.reason,
        revoked_by: request.revokedBy,
      },
      requestId,
    );
  }
}
