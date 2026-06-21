import { describe, expect, it } from 'vitest';
import { conceptSalience, filterConceptsForSection } from './conceptSectionBinding';
import type { Section } from './contentAnalysis';

const sections: Section[] = [
  {
    heading: 'Supply and Demand',
    text: 'Supply is the quantity producers offer at each price. Demand is quantity buyers want. Equilibrium occurs where supply meets demand.',
  },
  {
    heading: 'Elasticity',
    text: 'Price elasticity of demand measures responsiveness to price changes. Inelastic goods have low elasticity coefficients.',
  },
];

describe('conceptSectionBinding', () => {
  it('scores higher salience when concept words appear in section body', () => {
    const supplyScore = conceptSalience('supply quantity', sections[0]!.text);
    const supplyInElasticity = conceptSalience('supply quantity', sections[1]!.text);
    expect(supplyScore).toBeGreaterThan(supplyInElasticity);
  });

  it('filters concepts to their owning section', () => {
    const supplyConcepts = filterConceptsForSection(
      ['Supply Curve', 'Equilibrium Price', 'Elasticity Coefficient'],
      0,
      sections,
    );
    expect(supplyConcepts.some((c) => /supply|equilibrium/i.test(c))).toBe(true);
    expect(supplyConcepts.some((c) => /elasticity/i.test(c))).toBe(false);
  });
});
