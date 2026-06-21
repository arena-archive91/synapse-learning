import { describe, it, expect } from 'vitest';
import { buildCourseFromUpload, extractTopicsFromText, type UploadPayload } from './uploadPipeline';

/**
 * Regression tests for D9 (PRODUCT_SCALE_PLAN.md §4.A0): the no-outline fallback
 * course builder must be subject-agnostic — no hardcoded economics vocabulary,
 * never defaulting arbitrary material to "Economics".
 */

const LAW_TEXT = `A contract is a legally binding agreement between parties.
Liability arises when a party breaches a statutory duty. The plaintiff must
establish jurisdiction before the defendant can be held responsible under the
relevant legislation governing the dispute.`;

const BIO_TEXT = `Photosynthesis is the process by which plants convert light energy
into chemical energy. Chlorophyll in the chloroplast absorbs photons, driving the
synthesis of glucose from carbon dioxide and water inside the plant cell.`;

function payloadFor(text: string): UploadPayload {
  return { files: [], pastedContent: text, sourceMode: 'enriched', focusTags: [] };
}

describe('uploadPipeline D9 — subject-agnostic fallback', () => {
  it('never defaults non-economics content to "Economics"', () => {
    expect(buildCourseFromUpload(payloadFor(LAW_TEXT), 0).subject).not.toBe('Economics');
    expect(buildCourseFromUpload(payloadFor(BIO_TEXT), 0).subject).not.toBe('Economics');
  });

  it('classifies law content as Law (or General Studies), via the real classifier', () => {
    const course = buildCourseFromUpload(payloadFor(LAW_TEXT), 0);
    expect(['Law', 'General Studies']).toContain(course.subject);
  });

  it('derives topics from content, not a hardcoded keyword list', () => {
    const topics = extractTopicsFromText(BIO_TEXT, []);
    expect(topics.length).toBeGreaterThan(0);
    const joined = topics.join(' ').toLowerCase();
    expect(joined).not.toContain('cournot');
    expect(joined).not.toContain('bertrand');
    expect(joined).not.toContain('elasticity');
  });

  it('always produces at least one topic (falls back to the title)', () => {
    const course = buildCourseFromUpload(
      { files: [], pastedContent: 'short note', sourceMode: 'enriched', focusTags: [], title: 'My Notes' },
      0,
    );
    expect(course.topics.length).toBeGreaterThan(0);
  });

  it('is deterministic — same input yields the same subject + topic count', () => {
    const a = buildCourseFromUpload(payloadFor(BIO_TEXT), 0);
    const b = buildCourseFromUpload(payloadFor(BIO_TEXT), 0);
    expect(a.subject).toBe(b.subject);
    expect(a.topics.length).toBe(b.topics.length);
  });
});
