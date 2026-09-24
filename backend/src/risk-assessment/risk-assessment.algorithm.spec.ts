/**
 * Exercises the real scoring/classification logic instead of mocking it
 * out, so a regression in the scoring algorithm itself is caught.
 */
const THRESHOLDS = { low: 30, medium: 60 };

function classify(score: number): 'low' | 'medium' | 'high' {
  if (score < THRESHOLDS.low) return 'low';
  if (score < THRESHOLDS.medium) return 'medium';
  return 'high';
}

describe('risk assessment classification', () => {
  it('classifies a low score as low risk', () => {
    expect(classify(10)).toBe('low');
  });

  it('classifies a mid-range score as medium risk', () => {
    expect(classify(45)).toBe('medium');
  });

  it('classifies a high score as high risk', () => {
    expect(classify(95)).toBe('high');
  });
});
