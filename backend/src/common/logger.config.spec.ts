import { createLogger, transports } from 'winston';
import { buildWinstonOptions } from './logger.config';
import { runWithCorrelationId } from './correlation/correlation-id.storage';

describe('buildWinstonOptions', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(transports.Console.prototype, 'log')
      .mockImplementation(function (this: unknown, _info: unknown, callback: () => void) {
        callback();
      });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function lastLogLine(): Record<string, unknown> {
    const lastCall = logSpy.mock.calls[logSpy.mock.calls.length - 1];
    return lastCall[0] as Record<string, unknown>;
  }

  it('should include correlation ID in every log line', async () => {
    const logger = createLogger(buildWinstonOptions('info'));
    await runWithCorrelationId('corr-123', async () => {
      logger.info('hello');
    });

    const line = lastLogLine();
    expect(line.requestId).toBe('corr-123');
    expect(line.message).toBe('hello');
  });

  it('should redact authorization fields', () => {
    const logger = createLogger(buildWinstonOptions('info'));
    logger.info('login', {
      authorization: 'Bearer secret-token',
      nested: { password: 'super-secret', token: 'jwt-token' },
    });

    const line = lastLogLine();
    expect(line.authorization).toBe('[REDACTED]');
    expect((line.nested as Record<string, unknown>).password).toBe(
      '[REDACTED]',
    );
    expect((line.nested as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('should keep non-sensitive fields intact', () => {
    const logger = createLogger(buildWinstonOptions('info'));
    logger.info('request', {
      userId: 'user-1',
      path: '/api/documents',
    });

    const line = lastLogLine();
    expect(line.userId).toBe('user-1');
    expect(line.path).toBe('/api/documents');
  });

  it('should redact stellarSecretKey field', () => {
    const logger = createLogger(buildWinstonOptions('info'));
    logger.info('stellar config', {
      stellarSecretKey: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      horizonUrl: 'https://horizon-testnet.stellar.org',
    });

    const line = lastLogLine();
    expect(line.stellarSecretKey).toBe('[REDACTED]');
    expect(line.horizonUrl).toBe('https://horizon-testnet.stellar.org');
  });

  it('should redact stellar_secret_key field', () => {
    const logger = createLogger(buildWinstonOptions('info'));
    logger.info('config dump', {
      stellar_secret_key: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    });

    const line = lastLogLine();
    expect(line.stellar_secret_key).toBe('[REDACTED]');
  });
});