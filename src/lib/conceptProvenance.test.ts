import { describe, expect, it } from 'vitest';
import { buildConceptSpans, findConceptSpan, makeConceptId } from './conceptProvenance';
import type { Course, UploadedFile } from '../types';

const file: UploadedFile = {
  id: 'file-1',
  name: 'notes.txt',
  type: 'txt',
  size: 500,
  uploadedAt: '2026-01-01',
  status: 'analyzed',
  courseId: 'c-1',
  extractedText: `
Supply and Demand

The law of demand states that quantity demanded falls when price rises.
Elasticity measures how responsive quantity is to price changes.
Price elasticity of demand is often negative for normal goods.

Consumer surplus is the gap between willingness to pay and market price.
`.trim(),
};

describe('buildConceptSpans', () => {
  it('maps concepts to sentence-level char spans in source text', () => {
    const spans = buildConceptSpans(
      [file],
      ['elasticity', 'consumer surplus', 'law of demand'],
      'c-upload-test',
    );
    expect(spans.length).toBeGreaterThanOrEqual(2);
    for (const s of spans) {
      expect(s.conceptId).toBe(makeConceptId('c-upload-test', s.concept));
      expect(s.fileId).toBe('file-1');
      expect(s.charEnd).toBeGreaterThan(s.charStart);
      const excerpt = file.extractedText!.slice(s.charStart, s.charEnd);
      expect(excerpt.length).toBeGreaterThan(10);
    }
    const elasticity = spans.find((s) => s.concept.toLowerCase().includes('elastic'));
    expect(elasticity?.sentence?.toLowerCase()).toContain('elastic');
  });

  it('findConceptSpan resolves by normalized label', () => {
    const course: Course = {
      id: 'c-1',
      title: 'Test',
      description: '',
      subject: 'Econ',
      color: '#000',
      icon: '📚',
      totalLessons: 1,
      completedLessons: 0,
      mastery: 0,
      difficulty: 'beginner',
      topics: [],
      createdAt: '2026-01-01',
      estimatedHours: 1,
      sourceFiles: [],
      status: 'ready',
      sourceMode: 'strict',
      conceptCount: 1,
      glossaryCount: 0,
      exerciseCount: 0,
      conceptSpans: [
        {
          conceptId: 'x',
          concept: 'Consumer Surplus',
          chunkId: 'file-1#0',
          fileId: 'file-1',
          charStart: 10,
          charEnd: 40,
          sentence: 'Consumer surplus is important.',
        },
      ],
    };
    expect(findConceptSpan(course, 'consumer surplus')?.concept).toBe('Consumer Surplus');
  });
});
