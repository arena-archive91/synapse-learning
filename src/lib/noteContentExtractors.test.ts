import { describe, it, expect } from 'vitest';
import {
  extractComparisons,
  buildQuizFromNotes,
  rankDistractorTerms,
} from './noteContentExtractors';
import { isMcQuiz, quizKind } from './lessonTypes';
import type { GlossaryEntry } from '../types';

const g = (term: string, definition: string): GlossaryEntry => ({
  term,
  definition,
  source: 'test',
  relatedConcepts: [],
  courseId: 'test',
});

describe('extractComparisons', () => {
  it('parses a Markdown comparison table into rows', () => {
    const text = `
# Sorting algorithms

A comparison of common sorts:

| Algorithm | Best | Worst | Memory |
| --------- | ---- | ----- | ------ |
| Quicksort | n log n | n^2 | log n |
| Mergesort | n log n | n log n | n |
| Heapsort  | n log n | n log n | 1 |

These bounds apply to comparison sorts on average inputs.
    `.trim();

    const rows = extractComparisons(text, 'sorting algorithms', []);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Each row carries (dimension, left, right) — left and right must differ.
    for (const r of rows) {
      expect(r[1]).not.toBe(r[2]);
      expect(r[1].length).toBeGreaterThan(0);
      expect(r[2].length).toBeGreaterThan(0);
    }
    // The first column header should appear in the dimension labels.
    expect(rows.some((r) => /quicksort|mergesort|heapsort/i.test(r[0]))).toBe(true);
  });

  it('falls back to "X vs Y" patterns when no table is present', () => {
    const text = `
TCP vs UDP. TCP is connection-oriented, while UDP is connectionless.
TCP guarantees ordering, whereas UDP makes no such guarantee.
TCP performs flow and congestion control; UDP does not.
    `.trim();

    const rows = extractComparisons(text, 'TCP', []);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe('buildQuizFromNotes', () => {
  const passage = `
Linear regression fits a line to data by minimizing the sum of squared residuals.
Logistic regression models the probability of a binary outcome using the logistic function.
Ridge regression adds an L2 penalty to the coefficients to reduce variance.
Lasso regression adds an L1 penalty and can drive some coefficients to zero.
A residual is the difference between the observed value and the model prediction.
  `.trim();

  const glossary: GlossaryEntry[] = [
    g('Linear regression', 'A model that fits a line by minimizing the sum of squared residuals.'),
    g('Logistic regression', 'A model that predicts the probability of a binary outcome using the logistic function.'),
    g('Ridge regression', 'A regression model with an L2 penalty on coefficients.'),
    g('Lasso regression', 'A regression model with an L1 penalty on coefficients.'),
    g('Residual', 'The difference between observed and predicted values.'),
  ];

  it('produces a quiz where the correct answer is at the reported correctIndex (MC)', () => {
    const quiz = buildQuizFromNotes(passage, 'Linear regression', glossary, 'en');
    expect(quiz).not.toBeNull();
    if (!quiz || !isMcQuiz(quiz)) return;
    expect(quiz.options.length).toBeGreaterThanOrEqual(2);
    expect(quiz.correctIndex).toBeGreaterThanOrEqual(0);
    expect(quiz.correctIndex).toBeLessThan(quiz.options.length);
    expect(quiz.options[quiz.correctIndex]).toBeTruthy();
  });

  it('shuffles deterministically — same inputs produce the same option order (MC)', () => {
    const a = buildQuizFromNotes(passage, 'Linear regression', glossary, 'en');
    const b = buildQuizFromNotes(passage, 'Linear regression', glossary, 'en');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b || !isMcQuiz(a) || !isMcQuiz(b)) return;
    expect(a.options).toEqual(b.options);
    expect(a.correctIndex).toBe(b.correctIndex);
  });

  it('correct answer is not always at index 0 across different concepts (MC)', () => {
    const indices = new Set<number>();
    for (const concept of ['Linear regression', 'Logistic regression', 'Ridge regression', 'Lasso regression', 'Residual']) {
      const q = buildQuizFromNotes(passage, concept, glossary, 'en');
      if (q && isMcQuiz(q)) indices.add(q.correctIndex);
    }
    expect(indices.size).toBeGreaterThan(1);
  });

  it('can emit richer quiz kinds from the same material', () => {
    const kinds = new Set(
      ['Linear regression', 'Logistic regression', 'Residual', 'Ridge regression'].map(
        (c) => quizKind(buildQuizFromNotes(passage, c, glossary, 'en')!),
      ),
    );
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });
});

describe('rankDistractorTerms', () => {
  it('prefers near-miss terms over completely unrelated ones', () => {
    const glossary: GlossaryEntry[] = [
      g('Logistic regression', ''),
      g('Ridge regression', ''),
      g('Photosynthesis', ''),
      g('Mitochondria', ''),
    ];
    const distractors = rankDistractorTerms(glossary, 'Linear regression', 2);
    // The two regression-flavored terms should rank above the biology terms.
    expect(distractors).toContain('Logistic regression');
    expect(distractors).toContain('Ridge regression');
  });
});
