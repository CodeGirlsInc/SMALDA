import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  IValidationProvider,
  ValidationResponse,
} from '../interfaces/validation-provider.interface';
import { ValidationResult } from '../entities/validation-request.entity';

const REQUEST_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

@Injectable()
export class LandRegistryProvider implements IValidationProvider {
  private readonly logger = new Logger(LandRegistryProvider.name);
  private failureCount = 0;
  private circuitOpenUntil: Date | null = null;

  async validateDocument(): Promise<ValidationResponse> {
    this.checkCircuit();

    try {
      const result = await this.withTimeout(
        this.doValidate(),
        REQUEST_TIMEOUT_MS,
      );
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitOpenUntil = new Date(
          Date.now() + CIRCUIT_BREAKER_RESET_MS,
        );
        this.logger.warn(
          `Circuit breaker opened for LandRegistryProvider after ${this.failureCount} failures`,
        );
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return !this.isCircuitOpen();
  }

  private checkCircuit(): void {
    if (this.isCircuitOpen()) {
      throw new ServiceUnavailableException(
        'LandRegistryProvider circuit breaker is open',
      );
    }
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil && this.circuitOpenUntil > new Date()) {
      return true;
    }
    if (this.circuitOpenUntil && this.circuitOpenUntil <= new Date()) {
      this.circuitOpenUntil = null;
      this.failureCount = 0;
    }
    return false;
  }

  private async doValidate(): Promise<ValidationResponse> {
    return {
      result: ValidationResult.VALID,
      data: {},
      confidenceScore: null,
      externalReferenceId: null,
      validatedAt: new Date(),
      expiresAt: null,
      metadata: null,
      success: true,
      errorMessage: null,
    };
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new ServiceUnavailableException(
            `LandRegistryProvider request timed out after ${ms}ms`,
          ),
        );
      }, ms);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
