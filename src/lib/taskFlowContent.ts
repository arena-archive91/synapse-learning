/**
 * Note-grounded content for review, exam-prep, and prerequisite-repair task flows.
 * Falls back to minimal concept templates only when no uploaded source exists.
 */

import type { Course, GlossaryEntry, UploadedFile } from '../types';
import type { Lang } from './i18n';
import type { ExamQuestion, PrerequisiteStep } from './taskFlows';
import {
  extractDefinitions,
  normalizeConcept,
  splitSentences,
} from './contentAnalysis';
import {
  buildFlashcards,
  buildQuizFromNotes,
  conceptRelevanceScore,
  findMatchingTopic,
  gatherAnalyzedText,
  relevantExcerpt,
} from './noteContentExtractors';
import { isMcQuiz } from './lessonTypes';

export type TaskFlowContext = {
  uploadedFiles: UploadedFile[];
  glossaryEntries: GlossaryEntry[];
  courses: Course[];
  courseId?: string;
  lang: Lang;
};

function scopedGlossary(ctx: TaskFlowContext): GlossaryEntry[] {
  const linked =
    ctx.courseId ??
    ctx.uploadedFiles.find((f) => f.extractedText?.trim() && f.courseId)?.courseId;
  if (!linked) return ctx.glossaryEntries;
  return ctx.glossaryEntries.filter((g) => g.courseId === linked);
}

function scopedCourse(ctx: TaskFlowContext): Course | undefined {
  const linked =
    ctx.courseId ??
    ctx.uploadedFiles.find((f) => f.extractedText?.trim() && f.courseId)?.courseId;
  return linked ? ctx.courses.find((c) => c.id === linked) : undefined;
}

function shuffleOptions(correct: string, distractors: string[]): { options: string[]; correctIndex: number } {
  const unique = [correct, ...distractors.filter((d) => d !== correct)].slice(0, 4);
  while (unique.length < 4) {
    unique.push(`Option ${unique.length + 1}`);
  }
  const shuffled = [...unique].sort(() => Math.random() - 0.5);
  return { options: shuffled, correctIndex: Math.max(0, shuffled.indexOf(correct)) };
}

function genericReviewCards(concept: string, lang: Lang): { front: string; back: string }[] {
  return lang === 'el'
    ? [
        { front: `Ορισμός: ${concept}`, back: `Δώσε τον ορισμό και τα βασικά χαρακτηριστικά του «${concept}» από τις σημειώσεις σου.` },
        { front: `Εφαρμογή: ${concept}`, back: `Πώς θα χρησιμοποιούσες το «${concept}» σε μια άσκηση;` },
      ]
    : [
        { front: `Define: ${concept}`, back: `State the definition and key properties of «${concept}» from your notes.` },
        { front: `Apply: ${concept}`, back: `How would you use «${concept}» in a problem? Outline the steps.` },
      ];
}

function genericExamQuestions(concept: string, lang: Lang): ExamQuestion[] {
  const q = lang === 'el'
    ? `Ποια πρόταση περιγράφει καλύτερα το «${concept}»;`
    : `Which statement best describes «${concept}»?`;
  const opts = lang === 'el'
    ? ['Ο ορισμός από τις σημειώσεις σου', 'Άσχετη έννοια', 'Αντίθετη ιδέα', 'Ισχύει μόνο σε ειδικές περιπτώσεις']
    : ['The definition from your notes', 'An unrelated concept', 'The opposite idea', 'Only true in edge cases'];
  return [{ question: q, options: opts, correctIndex: 0 }];
}

function genericPrerequisiteSteps(concept: string, lang: Lang, target?: string): PrerequisiteStep[] {
  const dep = target ?? concept;
  return lang === 'el'
    ? [
        { title: `Επανάληψη: ${concept}`, body: `Ενίσχυσε τις βασικές ιδέες πίσω από το «${concept}» πριν συνεχίσεις.` },
        { title: 'Έλεγχος', body: `Επιβεβαίωσε ότι κατανοείς τα προαπαιτούμενα πριν το «${dep}».` },
      ]
    : [
        { title: `Review: ${concept}`, body: `Strengthen foundational ideas behind «${concept}» before continuing.` },
        { title: 'Checkpoint', body: `Confirm readiness before «${dep}».` },
      ];
}

export function resolveReviewCards(
  concept: string,
  ctx?: TaskFlowContext,
): { front: string; back: string }[] {
  if (!ctx) return genericReviewCards(concept, 'en');
  const { text, hasSource } = gatherAnalyzedText(ctx.uploadedFiles, ctx.courseId);
  if (!hasSource) return genericReviewCards(concept, ctx.lang);
  const cards = buildFlashcards(text, concept, scopedGlossary(ctx), ctx.lang);
  return cards.length > 0 ? cards : genericReviewCards(concept, ctx.lang);
}

export function resolveExamQuestions(concept: string, ctx?: TaskFlowContext): ExamQuestion[] {
  if (!ctx) return genericExamQuestions(concept, 'en');
  const { text, hasSource } = gatherAnalyzedText(ctx.uploadedFiles, ctx.courseId);
  if (!hasSource) return genericExamQuestions(concept, ctx.lang);

  const glossary = scopedGlossary(ctx);
  const excerpt = relevantExcerpt(text, concept, 12000);
  const questions: ExamQuestion[] = [];
  const seen = new Set<string>();

  const push = (q: ExamQuestion) => {
    const k = q.question.slice(0, 60);
    if (seen.has(k)) return;
    seen.add(k);
    questions.push(q);
  };

  // Glossary term MCQs
  const terms = glossary
    .filter((g) => conceptRelevanceScore(g.term + ' ' + g.definition, concept) > 0.15)
    .slice(0, 4);
  for (const g of terms) {
    const correct = g.definition.slice(0, 120);
    const distractors = glossary
      .filter((x) => x.term !== g.term)
      .map((x) => x.definition.slice(0, 120))
      .filter((d) => d !== correct)
      .slice(0, 3);
    const { options, correctIndex } = shuffleOptions(correct, distractors);
    push({
      question:
        ctx.lang === 'el'
          ? `Τι περιγράφει καλύτερα τον όρο «${g.term}» στις σημειώσεις σου;`
          : `Which option best describes «${g.term}» from your notes?`,
      options,
      correctIndex,
    });
  }

  // Sentence identification MCQs
  const sentences = splitSentences(excerpt)
    .filter((s) => conceptRelevanceScore(s, concept) > 0.25)
    .sort((a, b) => b.length - a.length);
  for (const correct of sentences.slice(0, 3)) {
    const distractors = sentences
      .filter((s) => s !== correct)
      .slice(0, 3)
      .map((s) => s.slice(0, 120));
    const { options, correctIndex } = shuffleOptions(correct.slice(0, 120), distractors);
    push({
      question:
        ctx.lang === 'el'
          ? `Ποια πρόταση από τις σημειώσεις σου σχετίζεται με «${concept}»;`
          : `Which sentence from your notes relates to «${concept}»?`,
      options,
      correctIndex,
    });
  }

  // Definition cloze from extracted definitions
  for (const d of extractDefinitions(excerpt, 3).filter((x) => conceptRelevanceScore(x.definition, concept) > 0.2)) {
    const blanked = d.definition.replace(new RegExp(d.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '___');
    if (!blanked.includes('___')) continue;
    const correct = d.term;
    const distractors = glossary
      .filter((g) => normalizeConcept(g.term) !== normalizeConcept(d.term))
      .map((g) => g.term)
      .slice(0, 3);
    const { options, correctIndex } = shuffleOptions(correct, distractors);
    push({
      question:
        ctx.lang === 'el'
          ? `Συμπλήρωσε: ${blanked.slice(0, 100)}`
          : `Fill in the blank: ${blanked.slice(0, 100)}`,
      options,
      correctIndex,
    });
  }

  if (questions.length >= 3) return questions.slice(0, 8);
  const quiz = buildQuizFromNotes(text, concept, glossary, ctx.lang);
  if (quiz && isMcQuiz(quiz)) push(quiz);
  return questions.length > 0 ? questions.slice(0, 8) : genericExamQuestions(concept, ctx.lang);
}

export function resolvePrerequisiteSteps(
  concept: string,
  ctx?: TaskFlowContext,
  targetConcept?: string,
): PrerequisiteStep[] {
  if (!ctx) return genericPrerequisiteSteps(concept, 'en', targetConcept);
  const { text, hasSource } = gatherAnalyzedText(ctx.uploadedFiles, ctx.courseId);
  if (!hasSource) return genericPrerequisiteSteps(concept, ctx.lang, targetConcept);

  const course = scopedCourse(ctx);
  const glossary = scopedGlossary(ctx);
  const topics = course?.topics ?? [];
  const topic = findMatchingTopic(topics, concept);
  const steps: PrerequisiteStep[] = [];

  let prereqNames = [...(topic?.prerequisites ?? [])];
  if (prereqNames.length === 0 && topics.length > 1) {
    const sorted = [...topics].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((t) => findMatchingTopic([t], concept));
    if (idx > 0) {
      prereqNames = sorted.slice(Math.max(0, idx - 2), idx).map((t) => t.title);
    }
  }

  for (const name of prereqNames.slice(0, 4)) {
    const g = glossary.find((x) => normalizeConcept(x.term) === normalizeConcept(name));
    const defs = extractDefinitions(relevantExcerpt(text, name, 5000), 4);
    const def =
      g?.definition ??
      defs.find((d) => normalizeConcept(d.term) === normalizeConcept(name))?.definition ??
      defs[0]?.definition;
    steps.push({
      title: name,
      body:
        def ??
        (ctx.lang === 'el'
          ? `Επανάληψη του «${name}» από τις σημειώσεις σου πριν συνεχίσεις.`
          : `Review «${name}» from your uploaded material before continuing.`),
    });
  }

  if (steps.length === 0) {
    for (const d of extractDefinitions(relevantExcerpt(text, concept, 8000), 3)) {
      steps.push({ title: d.term, body: d.definition });
    }
  }

  const dep = targetConcept ?? concept;
  steps.push({
    title: ctx.lang === 'el' ? 'Έλεγχος' : 'Checkpoint',
    body:
      ctx.lang === 'el'
        ? `Επιβεβαίωσε ότι κατανοείς τα προαπαιτούμενα πριν συνεχίσεις στο «${dep}».`
        : `Confirm you understand the prerequisites before continuing to «${dep}».`,
  });

  return steps.length > 1 ? steps : genericPrerequisiteSteps(concept, ctx.lang, targetConcept);
}

export function resolvePrerequisiteCheckpoint(
  concept: string,
  ctx?: TaskFlowContext,
): { question: string; options: string[]; correctIndex: number } | undefined {
  if (!ctx) return undefined;
  const { text, hasSource } = gatherAnalyzedText(ctx.uploadedFiles, ctx.courseId);
  if (!hasSource) return undefined;
  const quiz = buildQuizFromNotes(text, concept, scopedGlossary(ctx), ctx.lang);
  if (!quiz || !isMcQuiz(quiz)) return undefined;
  return { question: quiz.question, options: quiz.options, correctIndex: quiz.correctIndex };
}

export function buildTaskFlowContext(opts: {
  uploadedFiles: UploadedFile[];
  glossaryEntries: GlossaryEntry[];
  courses: Course[];
  courseId?: string;
  lang: Lang;
}): TaskFlowContext {
  return opts;
}
