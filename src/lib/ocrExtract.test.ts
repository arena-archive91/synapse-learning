import { describe, expect, it } from 'vitest';
import { needsOcr, OCR_MIN_TOTAL_CHARS } from './ocrExtract';

describe('needsOcr', () => {
  it('returns false for text-rich PDF extraction', () => {
    const text = 'Supply and demand determine market equilibrium in competitive markets. '.repeat(3);
    expect(needsOcr(text, 2)).toBe(false);
  });

  it('returns true when text layer is nearly empty', () => {
    expect(needsOcr('   ', 5)).toBe(true);
    expect(needsOcr('page 1', 4)).toBe(true);
  });

  it('returns true when total chars fall below threshold', () => {
    expect(needsOcr('a'.repeat(OCR_MIN_TOTAL_CHARS - 1), 1)).toBe(true);
  });
});
