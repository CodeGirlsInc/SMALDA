import {
  correlationIdStorage,
  generateCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from './correlation-id.storage';

describe('CorrelationIdStorage', () => {
  afterEach(() => {
    correlationIdStorage.disable();
  });

  describe('generateCorrelationId', () => {
    it('should honor an inbound header value', () => {
      const id = generateCorrelationId('inbound-id');
      expect(id).toBe('inbound-id');
    });

    it('should use the first value when inbound is an array', () => {
      const id = generateCorrelationId(['first-id', 'second-id']);
      expect(id).toBe('first-id');
    });

    it('should generate a UUID when no inbound header is provided', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate a UUID for empty headers', () => {
      const id = generateCorrelationId('   ');
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('runWithCorrelationId', () => {
    it('should make the correlation ID available inside the callback', async () => {
      await runWithCorrelationId('test-correlation-id', async () => {
        expect(getCorrelationId()).toBe('test-correlation-id');
      });
    });

    it('should return the callback result', async () => {
      const result = await runWithCorrelationId('id', async () => 42);
      expect(result).toBe(42);
    });
  });

  describe('getCorrelationId', () => {
    it('should return fallback when no correlation ID is set', () => {
      expect(getCorrelationId()).toBe('no-correlation-id');
      expect(getCorrelationId('fallback')).toBe('fallback');
    });
  });
});
