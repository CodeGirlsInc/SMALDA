import {
  RiskFlag,
  RISK_FLAG_DESCRIPTIONS,
} from './risk-assessment.service';

describe('Risk flag localization', () => {
  it('should have descriptions for all risk flags', () => {
    const flags = Object.values(RiskFlag);
    for (const flag of flags) {
      expect(RISK_FLAG_DESCRIPTIONS[flag]).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['en']).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['fr']).toBeDefined();
      expect(RISK_FLAG_DESCRIPTIONS[flag]['es']).toBeDefined();
    }
  });

  it('should have non-empty descriptions', () => {
    for (const [flag, descriptions] of Object.entries(RISK_FLAG_DESCRIPTIONS)) {
      for (const [lang, desc] of Object.entries(descriptions)) {
        expect(desc.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('should return English description for unknown locale', () => {
    const desc = RISK_FLAG_DESCRIPTIONS[RiskFlag.MISSING_PARCEL_ID];
    expect(desc['xx']).toBeUndefined();
    expect(desc['en']).toContain('parcel');
  });
});
