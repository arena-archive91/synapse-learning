import { describe, it, expect } from 'vitest';
import {
  splitSentences,
  detectSections,
  normalizeConcept,
  stemLite,
  extractiveSummary,
  analyzeContentToOutline,
} from './contentAnalysis';

describe('splitSentences', () => {
  it('splits English sentences', () => {
    const s = splitSentences('Supply rises when price increases. Demand falls at higher prices.');
    expect(s.length).toBeGreaterThanOrEqual(2);
  });
});

describe('detectSections', () => {
  it('detects markdown-style headings', () => {
    const text = `# Introduction\n\nFirst paragraph about markets.\n\n## Elasticity\n\nPrice elasticity measures responsiveness.`;
    const sections = detectSections(text);
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((s) => s.heading?.toLowerCase().includes('elastic'))).toBe(true);
  });
});

describe('normalizeConcept / stemLite', () => {
  it('stems English plurals', () => {
    expect(stemLite('markets')).toBe(stemLite('market'));
  });

  it('normalizes multi-word concepts', () => {
    expect(normalizeConcept('Market Structures')).toBe(normalizeConcept('market structure'));
  });
});

describe('analyzeContentToOutline', () => {
  it('builds outline from substantive note text', () => {
    const text = `
# Supply and Demand

Supply is the quantity producers offer at each price. Demand is quantity buyers want.

When supply increases, equilibrium price tends to fall.

# Elasticity

Price elasticity of demand measures percentage change in quantity divided by percentage change in price.
Elastic demand means consumers are very responsive to price changes.

Definition: Consumer surplus is the area between the demand curve and market price.
    `.trim();

    const outline = analyzeContentToOutline(text, ['notes.md']);
    expect(outline).not.toBeNull();
    expect(outline!.topics.length).toBeGreaterThanOrEqual(1);
    expect(outline!.glossary.length).toBeGreaterThanOrEqual(0);
    expect(outline!.title.length).toBeGreaterThan(3);
  });

  it('returns null for very short text', () => {
    expect(analyzeContentToOutline('too short', [])).toBeNull();
  });

  it('produces Bloom-aware objectives that vary across cognitive levels', () => {
    const text = `
# Markov Decision Processes

A Markov Decision Process is a tuple of states, actions, transition probabilities, and rewards.
The Bellman equation expresses the value of a state recursively in terms of immediate reward and discounted future value.

# Value Iteration

Value iteration applies the Bellman update repeatedly until convergence.
Convergence is guaranteed when the discount factor is strictly less than one.

# Policy Iteration

Policy iteration alternates policy evaluation with policy improvement.
It converges in finitely many steps for finite Markov Decision Processes.
    `.trim();
    const outline = analyzeContentToOutline(text, ['rl.md']);
    expect(outline).not.toBeNull();
    const objectives = outline!.topics.flatMap((t) => t.objectives ?? []);
    expect(objectives.length).toBeGreaterThan(0);
    const verbs = objectives.map((o) => o.split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
    const distinctVerbs = new Set(verbs);
    expect(distinctVerbs.size).toBeGreaterThanOrEqual(2);
  });
});

describe('extractiveSummary', () => {
  const passage = `
Recurrent neural networks process sequences by maintaining a hidden state across time steps.
Long Short-Term Memory networks extend recurrent neural networks with gating mechanisms.
The transformer architecture replaces recurrence with self-attention layers.
Self-attention computes pairwise interactions between every pair of tokens in the input.
Transformers scale better than recurrent neural networks because attention is parallelizable.
Recurrent neural networks struggle with long-range dependencies because gradients vanish.
The transformer's positional encoding injects sequence order into the otherwise permutation-invariant attention.
  `.trim();

  it('returns the requested number of distinct sentences', () => {
    const summary = extractiveSummary(passage, 3);
    expect(summary.length).toBe(3);
    const unique = new Set(summary);
    expect(unique.size).toBe(3);
  });

  it('biased TextRank surfaces sentences that mention the bias term', () => {
    const biased = extractiveSummary(passage, 2, { biasTerms: ['transformer'], leadBias: 0 });
    const transformerHits = biased.filter((s) => /transformer|attention/i.test(s)).length;
    expect(transformerHits).toBeGreaterThanOrEqual(1);
  });

  it('MMR penalty avoids two near-duplicate sentences in top-2', () => {
    const repetitive = `
Photosynthesis converts light energy into chemical energy.
Photosynthesis converts light energy into chemical energy stored as glucose.
Cellular respiration releases energy stored in glucose.
Cellular respiration uses oxygen to break down glucose.
Plants use chlorophyll molecules to capture light.
    `.trim();
    const summary = extractiveSummary(repetitive, 2, { mmrLambda: 0.4 });
    expect(summary.length).toBe(2);
    expect(summary[0]).not.toBe(summary[1]);
  });
});
