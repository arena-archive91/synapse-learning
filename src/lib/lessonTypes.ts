import type { Lang } from './i18n';

export type LessonStepKey =
  | 'intro'
  | 'explanation'
  | 'example'
  | 'misconception'
  | 'practice'
  | 'quiz'
  | 'summary';

export type LessonStepDef = { key: LessonStepKey; label: string };

export type QuizKind = 'mc' | 'short-answer' | 'ordering' | 'matching';

/** Discriminated quiz payload — `kind` defaults to `mc` for backward compatibility. */
export type QuizDef =
  | {
      kind?: 'mc';
      question: string;
      options: string[];
      correctIndex: number;
    }
  | {
      kind: 'short-answer';
      question: string;
      acceptedAnswers: string[];
      hint?: string;
    }
  | {
      kind: 'ordering';
      question: string;
      items: string[];
      correctOrder: number[];
    }
  | {
      kind: 'matching';
      question: string;
      left: string[];
      right: string[];
      pairs: [number, number][];
    };

export function quizKind(def: QuizDef): QuizKind {
  return def.kind ?? 'mc';
}

export function isMcQuiz(def: QuizDef): def is Extract<QuizDef, { options: string[] }> {
  return quizKind(def) === 'mc';
}

const STEP_LABELS: Record<Lang, Record<LessonStepKey, string>> = {
  en: {
    intro: 'Introduction',
    explanation: 'Core Concept',
    example: 'Example',
    misconception: 'Common Mistakes',
    practice: 'Practice',
    quiz: 'Check',
    summary: 'Summary',
  },
  el: {
    intro: 'Εισαγωγή',
    explanation: 'Βασική Έννοια',
    example: 'Παράδειγμα',
    misconception: 'Συχνά Λάθη',
    practice: 'Εξάσκηση',
    quiz: 'Έλεγχος',
    summary: 'Περίληψη',
  },
};

export function lessonStepLabel(key: LessonStepKey, lang: Lang): string {
  return STEP_LABELS[lang][key];
}

/** Generic upload-gated quiz placeholder (no domain-specific demo content). */
export function genericQuizPlaceholder(concept: string, lang: Lang): QuizDef {
  return {
    question: lang === 'el'
      ? `Ανέβασε σημειώσεις για κουίζ στο «${concept}».`
      : `Upload notes to generate a quiz for «${concept}».`,
    options: lang === 'el'
      ? ['Θα δημιουργηθεί από το υλικό σου', '—', '—', '—']
      : ['Will be generated from your material', '—', '—', '—'],
    correctIndex: 0,
  };
}

export type WorkspaceStep = { title: string; type: string };

/** Minimal step rail when no note sections exist yet. */
export function genericWorkspaceSteps(concept: string, lang: Lang): WorkspaceStep[] {
  const quizStep = lang === 'el'
    ? { title: 'Έλεγχος Γνώσεων', type: 'Κουίζ' }
    : { title: 'Knowledge Check', type: 'Quiz' };
  if (lang === 'el') {
    return [
      { title: concept, type: 'Βασική Έννοια' },
      { title: 'Μηχανισμός', type: 'Εμβάθυνση' },
      { title: 'Εφαρμογή', type: 'Εξάσκηση' },
      quizStep,
    ];
  }
  return [
    { title: concept, type: 'Core Concept' },
    { title: 'Mechanism', type: 'Deep Dive' },
    { title: 'Application', type: 'Practice' },
    quizStep,
  ];
}
