/**
 * Assembles personalized, note-grounded content for every Study Workspace tool.
 * When no uploaded source exists, tools receive empty payloads — never demo data.
 */

import type { Lang } from './i18n';
import type { QuizDef } from './domainContent';
import type { Course, GlossaryEntry, LearnerModel, Topic, UploadedFile } from '../types';
import type { DebateNode, ConceptMapEdge, ConceptMapNode, ExtractedFormula } from './noteContentExtractors';
import {
  buildConceptMapFromCourse,
  buildDebateTreeFromNotes,
  buildFeynmanGaps,
  buildFeynmanOutline,
  buildFlashcards,
  buildQuizFromNotes,
  buildWorkspaceStepsFromNotes,
  extractComparisons,
  extractFormulas,
  findMatchingTopic,
  gatherAnalyzedText,
  notesSupportEconomicsSandbox,
  relevantExcerpt,
  sandboxInsightFromNotes,
} from './noteContentExtractors';

export interface WorkspaceNoteBundle {
  hasSource: boolean;
  sourceName: string;
  fileKey: string;
  /** Full relevant excerpt for reader + lesson grounding. */
  readerText: string;
  /** Tighter excerpt for annotation/source panel. */
  annotationText: string;
  conceptMap: { nodes: ConceptMapNode[]; edges: ConceptMapEdge[] };
  leitnerCards: { front: string; back: string }[];
  compareRows: [string, string, string][];
  formulas: ExtractedFormula[];
  debateTree: DebateNode | null;
  feynmanOutline: string[];
  feynmanGaps: string[];
  feynmanPlaceholder: string;
  workspaceSteps: { title: string; type: string }[] | null;
  quiz: QuizDef | null;
  economicsSandbox: boolean;
  sandboxInsight: string;
  matchingTopic: Topic | undefined;
  courseTitle: string | undefined;
  emptyMessage: string;
}

export function buildWorkspaceNoteBundle(opts: {
  uploadedFiles: UploadedFile[];
  glossaryEntries: GlossaryEntry[];
  courses: Course[];
  courseId?: string;
  concept: string;
  conceptBars: { concept: string; mastery: number }[];
  lang: Lang;
  learnerModel?: LearnerModel;
}): WorkspaceNoteBundle {
  const { uploadedFiles, glossaryEntries, courses, courseId, concept, conceptBars, lang, learnerModel } = opts;

  const { text, fileNames, hasSource } = gatherAnalyzedText(uploadedFiles, courseId);
  const linkedCourseId =
    courseId ?? uploadedFiles.find((f) => f.extractedText?.trim() && f.courseId)?.courseId;
  const course = linkedCourseId ? courses.find((c) => c.id === linkedCourseId) : undefined;
  const scopedGlossary = glossaryEntries.filter(
    (g) => linkedCourseId && g.courseId === linkedCourseId,
  );
  const topics = course?.topics ?? [];
  const matchingTopic = findMatchingTopic(topics, concept);

  const emptyMessage =
    lang === 'el'
      ? 'Ανέβασε σημειώσεις για να εμφανιστεί εξατομικευμένο περιεχόμενο από το δικό σου υλικό.'
      : 'Upload your notes to see personalized content from your own material.';

  if (!hasSource) {
    return {
      hasSource: false,
      sourceName: '',
      fileKey: 'no-source',
      readerText: '',
      annotationText: '',
      conceptMap: { nodes: [], edges: [] },
      leitnerCards: [],
      compareRows: [],
      formulas: [],
      debateTree: null,
      feynmanOutline: lang === 'el'
        ? [`Ανέβασε τις σημειώσεις σου για το «${concept}»`, 'Μετά εξήγησε με δικά σου λόγια μόνο από το υλικό σου']
        : [`Upload your notes for «${concept}»`, 'Then explain in your own words using only your material'],
      feynmanGaps: lang === 'el'
        ? ['Χωρίς ανεβασμένο υλικό δεν μπορούμε να ελέγξουμε ακρίβεια — ανέβασε πρώτα τις σημειώσεις.']
        : ['Without uploaded material we cannot verify accuracy — upload your notes first.'],
      feynmanPlaceholder:
        lang === 'el'
          ? `Εξήγησε το «${concept}» — ανέβασε πρώτα τις σημειώσεις σου για στοχευμένη ανατροφοδότηση.`
          : `Explain «${concept}» — upload your notes first for targeted feedback.`,
      workspaceSteps: null,
      quiz: null,
      economicsSandbox: false,
      sandboxInsight: '',
      matchingTopic: undefined,
      courseTitle: undefined,
      emptyMessage,
    };
  }

  const readerText = relevantExcerpt(text, concept, 12000);
  const annotationText = relevantExcerpt(text, concept, 16000);
  const sourceName = fileNames.join(', ') || course?.title || 'Your notes';
  const fileKey = fileNames[0] ?? courseId ?? 'notes';

  const conceptMap = buildConceptMapFromCourse(topics, scopedGlossary, conceptBars, concept, text);
  const leitnerFromNotes = buildFlashcards(text, concept, scopedGlossary, lang);

  // Merge FSRS spacing cards that match the concept, but only if they exist in learner model.
  const spacingCards = (learnerModel?.spacingIntervals ?? [])
    .filter((s) => s.concept.toLowerCase().includes(concept.toLowerCase().slice(0, 5))
      || concept.toLowerCase().includes(s.concept.toLowerCase().slice(0, 5)))
    .map((s) => ({
      front: s.concept,
      back: scopedGlossary.find((g) => g.term.toLowerCase().includes(s.concept.toLowerCase().slice(0, 6)))?.definition
        ?? (lang === 'el' ? `Επόμενη επανάληψη σε ${Math.round(s.interval)} ημέρες` : `Next review in ${Math.round(s.interval)} days`),
    }));

  const leitnerCards = [...spacingCards, ...leitnerFromNotes].filter(
    (c, i, arr) => arr.findIndex((x) => x.front === c.front) === i,
  );

  return {
    hasSource: true,
    sourceName,
    fileKey,
    readerText,
    annotationText,
    conceptMap,
    leitnerCards,
    compareRows: extractComparisons(text, concept, scopedGlossary),
    formulas: extractFormulas(text, concept),
    debateTree: buildDebateTreeFromNotes(text, concept),
    feynmanOutline: buildFeynmanOutline(matchingTopic, text, concept, lang),
    feynmanGaps: buildFeynmanGaps(scopedGlossary, concept, lang),
    feynmanPlaceholder:
      lang === 'el'
        ? `Εξήγησε το «${concept}» με απλά λόγια, βασιζόμενος/η μόνο στις σημειώσεις σου…`
        : `Explain «${concept}» simply, using only your uploaded notes…`,
    workspaceSteps: buildWorkspaceStepsFromNotes(text, concept, lang),
    quiz: buildQuizFromNotes(text, concept, scopedGlossary, lang),
    economicsSandbox: notesSupportEconomicsSandbox(text, concept),
    sandboxInsight: sandboxInsightFromNotes(text, concept, lang),
    matchingTopic,
    courseTitle: course?.title,
    emptyMessage,
  };
}
