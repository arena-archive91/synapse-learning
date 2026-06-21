import type { Course, GlossaryEntry, UploadedFile, UserSettings } from '../types';
import { extractTextFromFile } from './pdfExtract';
import { inferSubject, rankKeyphrases, titleCasePhrase } from './contentAnalysis';
import type { GeneratedOutline } from './courseGenerator';

/**
 * Derive candidate topic titles from the material itself — subject-agnostic.
 * Uses content keyphrases (RAKE+TextRank blend) plus filename-derived names;
 * no hardcoded domain vocabulary (see PRODUCT_SCALE_PLAN.md §4.A0 / D9).
 */
export function extractTopicsFromText(text: string, fileNames: string[] = []): string[] {
  const fromContent = rankKeyphrases(text ?? '', 8)
    .map((k) => titleCasePhrase(k.phrase))
    .filter((t) => t.length >= 4);
  const fromNames = fileNames
    .map((n) => titleCasePhrase(n.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')))
    .filter((n) => n.length > 3);
  return [...new Set([...fromNames, ...fromContent])].slice(0, 12);
}

export type UploadPayload = {
  files: File[];
  pastedContent?: string;
  youtubeUrl?: string;
  sourceMode: Course['sourceMode'];
  focusTags: string[];
  examDate?: string;
  title?: string;
  /** When set, merge new material into this course instead of creating a new one. */
  targetCourseId?: string;
  uploadMode?: 'new' | 'extend';
};

export function buildCourseFromUpload(payload: UploadPayload, existingCount: number): Course {
  const primaryName = payload.files[0]?.name ?? payload.youtubeUrl ?? 'Custom Material';
  const title = payload.title ?? primaryName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const rawTopics = extractTopicsFromText(payload.pastedContent ?? '', payload.files.map((f) => f.name));
  const topics = rawTopics.length > 0 ? rawTopics : [title];

  return {
    id: `c-upload-${Date.now()}`,
    title,
    description: `Generated from ${payload.files.length} file(s)${payload.youtubeUrl ? ' + video' : ''}. Focus: ${payload.focusTags.join(', ') || 'General'}.`,
    subject: inferSubject(payload.pastedContent ?? ''),
    color: ['#818cf8', '#22d3ee', '#2dd4bf', '#fb923c'][existingCount % 4]!,
    icon: '📚',
    totalLessons: Math.max(6, topics.length * 2),
    completedLessons: 0,
    mastery: 0,
    difficulty: payload.focusTags.includes('Beginner-friendly') ? 'beginner' : 'intermediate',
    topics: topics.slice(0, 6).map((t, i) => ({
      id: `ut-${Date.now()}-${i}`,
      title: t,
      description: `Extracted topic: ${t}`,
      lessons: [],
      mastery: 0,
      prerequisites: i > 0 ? [`ut-${Date.now()}-${i - 1}`] : [],
      order: i + 1,
      isLocked: false,
      estimatedMinutes: 20,
      conceptCount: 4,
      retentionPrediction: 0,
    })),
    createdAt: new Date().toISOString().slice(0, 10),
    estimatedHours: Math.max(4, topics.length),
    sourceFiles: [
      ...payload.files.map((f) => f.name),
      ...(payload.youtubeUrl ? [payload.youtubeUrl] : []),
    ],
    status: 'ready',
    sourceMode: payload.sourceMode,
    conceptCount: topics.length * 4,
    glossaryCount: topics.length * 2,
    exerciseCount: topics.length * 3,
    examDate: payload.examDate,
  };
}

const COURSE_COLORS = ['#818cf8', '#22d3ee', '#2dd4bf', '#fb923c', '#f472b6', '#a78bfa'];

/**
 * Build a rich Course from an AI-generated outline. Preserves the same Course
 * shape used everywhere else, but populated from the real material: ordered
 * topics, prerequisite edges (by topic title), per-topic concepts, and a real
 * glossary count. Falls back gracefully — callers use `buildCourseFromUpload`
 * when no outline is available.
 */
export function buildCourseFromOutline(
  outline: GeneratedOutline,
  payload: UploadPayload,
  existingCount: number,
): { course: Course; glossary: GlossaryEntry[] } {
  const now = Date.now();
  const courseId = `c-upload-${now}`;
  const titleToId = new Map<string, string>();
  outline.topics.forEach((t, i) => titleToId.set(t.title.toLowerCase(), `ut-${now}-${i}`));

  const totalConcepts = outline.topics.reduce((sum, t) => sum + t.concepts.length, 0);

  const topics = outline.topics.map((t, i) => {
    const prerequisites = t.prerequisites
      .map((p) => titleToId.get(p.toLowerCase()))
      .filter((id): id is string => Boolean(id));
    return {
      id: `ut-${now}-${i}`,
      title: t.title,
      description: t.description,
      lessons: [],
      mastery: 0,
      prerequisites,
      order: i + 1,
      isLocked: false,
      estimatedMinutes: t.estimatedMinutes,
      conceptCount: t.concepts.length,
      retentionPrediction: 0,
      keyConcepts: t.concepts.slice(0, 8),
      ...(t.objectives && t.objectives.length > 0 ? { objectives: t.objectives } : {}),
    };
  });

  // Relate each glossary term to the topic concepts that mention it, so the
  // concept graph and glossary cross-link instead of being isolated entries.
  const allConcepts = outline.topics.flatMap((t) => t.concepts);
  const glossary: GlossaryEntry[] = outline.glossary.map((g) => {
    const termLower = g.term.toLowerCase();
    const related = allConcepts
      .filter((c) => c.toLowerCase() !== termLower && (c.toLowerCase().includes(termLower) || termLower.includes(c.toLowerCase())))
      .slice(0, 5);
    return {
      term: g.term,
      definition: g.definition,
      source: payload.files[0]?.name ?? payload.youtubeUrl ?? 'Uploaded material',
      relatedConcepts: related,
      courseId,
    };
  });

  const course: Course = {
    id: courseId,
    title: outline.title,
    description: outline.summary || `Generated from ${payload.files.length} file(s). Focus: ${payload.focusTags.join(', ') || 'General'}.`,
    subject: outline.subject,
    color: COURSE_COLORS[existingCount % COURSE_COLORS.length]!,
    icon: '📚',
    totalLessons: Math.max(6, outline.topics.length * 2),
    completedLessons: 0,
    mastery: 0,
    difficulty: outline.difficulty,
    topics,
    createdAt: new Date().toISOString().slice(0, 10),
    estimatedHours: Math.max(2, Math.round(outline.topics.reduce((s, t) => s + t.estimatedMinutes, 0) / 60)),
    sourceFiles: [
      ...payload.files.map((f) => f.name),
      ...(payload.youtubeUrl ? [payload.youtubeUrl] : []),
    ],
    status: 'ready',
    sourceMode: payload.sourceMode,
    conceptCount: totalConcepts,
    glossaryCount: glossary.length,
    exerciseCount: outline.topics.length * 3,
    examDate: payload.examDate,
  };

  return { course, glossary };
}

export async function readTextFromFiles(files: File[], settings?: UserSettings): Promise<string> {
  const parts: string[] = [];
  for (const f of files) {
    try {
      const { text } = await extractTextFromFile(f, settings);
      if (text.trim()) parts.push(text);
    } catch {
      /* ignore unreadable files */
    }
  }
  return parts.join('\n\n');
}

export async function extractFileContent(
  file: File,
  settings?: UserSettings,
): Promise<{ text: string; pageCount?: number; ocrUsed?: boolean }> {
  return extractTextFromFile(file, settings);
}

export function uploadedFileMeta(
  file: File,
  courseId?: string,
  topics?: string[],
  extractedText?: string,
  pageCount?: number,
): UploadedFile {
  return {
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    type: inferFileType(file.name),
    size: file.size,
    uploadedAt: new Date().toISOString(),
    status: 'analyzed',
    progress: 100,
    courseId,
    extractedTopics: topics,
    extractedText,
    pageCount,
    detectedLanguage: 'en',
  };
}

function inferFileType(name: string): UploadedFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'docx': case 'doc': return 'docx';
    case 'pptx': case 'ppt': return 'pptx';
    case 'txt': return 'txt';
    case 'md': return 'md';
    case 'csv': return 'csv';
    case 'py': case 'js': case 'ts': return 'code';
    default: return 'pdf';
  }
}
