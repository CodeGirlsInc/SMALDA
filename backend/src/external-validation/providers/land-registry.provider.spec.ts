import { ServiceUnavailableException } from '@nestjs/common';
import { LandRegistryProvider } from './land-registry.provider';

describe('LandRegistryProvider', () => {
  let provider: LandRegistryProvider;

  beforeEach(() => {
    provider = new LandRegistryProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return a valid response', async () => {
    const result = await provider.validateDocument();
    expect(result.success).toBe(true);
    expect(result.result).toBe('VALID');
  });

  it('should report healthy when circuit is closed', async () => {
    const healthy = await provider.healthCheck();
    expect(healthy).toBe(true);
  });

  it('should open circuit after threshold failures', async () => {
    for (let i = 0; i < 3; i++) {
      (provider as any).failureCount++;
    }
    (provider as any).circuitOpenUntil = new Date(Date.now() + 60000);

    await expect(provider.validateDocument()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
