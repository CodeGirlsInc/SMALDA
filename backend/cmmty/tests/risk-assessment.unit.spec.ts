import { Test, TestingModule } from '@nestjs/testing';
import { RiskAssessmentService } from '../src/modules/risk/risk-assessment.service';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RiskAssessmentService],
    }).compile();

    service = module.get<RiskAssessmentService>(
      RiskAssessmentService,
    );
  });

  const baseDocument = {
    amount: 100,
    country: 'NG',
    duplicateHash: false,
    suspiciousMetadata: false,
    blacklistedSender: false,
    invalidSignature: false,
    rapidSubmission: false,
    tamperedDocument: false,
  };

  it('detects duplicate hash flag', () => {
    const result = service.assess({
      ...baseDocument,
      duplicateHash: true,
    });

    expect(result.flags).toContain('DUPLICATE_HASH');
  });

  it('detects suspicious metadata flag', () => {
    const result = service.assess({
      ...baseDocument,
      suspiciousMetadata: true,
    });

    expect(result.flags).toContain(
      'SUSPICIOUS_METADATA',
    );
  });

  it('detects blacklisted sender flag', () => {
    const result = service.assess({
      ...baseDocument,
      blacklistedSender: true,
    });

    expect(result.flags).toContain(
      'BLACKLISTED_SENDER',
    );
  });

  it('detects invalid signature flag', () => {
    const result = service.assess({
      ...baseDocument,
      invalidSignature: true,
    });

    expect(result.flags).toContain(
      'INVALID_SIGNATURE',
    );
  });

  it('detects rapid submission flag', () => {
    const result = service.assess({
      ...baseDocument,
      rapidSubmission: true,
    });

    expect(result.flags).toContain(
      'RAPID_SUBMISSION',
    );
  });

  it('detects tampered document flag', () => {
    const result = service.assess({
      ...baseDocument,
      tamperedDocument: true,
    });

    expect(result.flags).toContain(
      'TAMPERED_DOCUMENT',
    );
  });

  it('returns score = 0 when no flags exist', () => {
    const result = service.assess(baseDocument);

    expect(result.score).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it('caps score at 100 with multiple high-weight flags', () => {
    const result = service.assess({
      ...baseDocument,
      duplicateHash: true,
      suspiciousMetadata: true,
      blacklistedSender: true,
      invalidSignature: true,
      rapidSubmission: true,
      tamperedDocument: true,
    });

    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('triggers all 6 flags simultaneously', () => {
    const result = service.assess({
      ...baseDocument,
      duplicateHash: true,
      suspiciousMetadata: true,
      blacklistedSender: true,
      invalidSignature: true,
      rapidSubmission: true,
      tamperedDocument: true,
    });

    expect(result.flags).toEqual(
      expect.arrayContaining([
        'DUPLICATE_HASH',
        'SUSPICIOUS_METADATA',
        'BLACKLISTED_SENDER',
        'INVALID_SIGNATURE',
        'RAPID_SUBMISSION',
        'TAMPERED_DOCUMENT',
      ]),
    );
  });
});