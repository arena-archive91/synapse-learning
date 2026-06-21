import { describe, expect, it } from 'vitest';
import { extractEntities } from './entityExtract';

describe('entityExtract', () => {
  it('extracts definitions and acronyms from text', () => {
    const text = `
Supply is the quantity producers offer at each price.
Demand is the quantity buyers want at each price.
Price Elasticity of Demand (PED) measures responsiveness to price changes.
Market Equilibrium occurs where supply meets demand.
    `.trim();

    const entities = extractEntities(text);
    expect(entities.length).toBeGreaterThan(2);
    expect(entities.some((e) => /supply|demand|elasticity|equilibrium/i.test(e.term))).toBe(true);
  });
});
