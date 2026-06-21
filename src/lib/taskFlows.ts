import type { Task, AgentMode, MistakeRecord } from '../types';
import { isSameConcept } from './skillNodes';

export type TaskAction = 'lesson' | 'practical' | 'workspace' | 'agent' | 'tasks-review' | 'tasks-fix' | 'tasks-prereq' | 'exam-prep';

export type SessionType = '10min' | '25min' | '50min' | 'cram' | 'review';

export function getTaskAction(task: Task): TaskAction {
  if (task.type === 'exam-prep' || task.type === 'timed-test') return 'exam-prep';
  if (task.type === 'practice') return 'practical';
  if (task.isSpacedRepetition || task.type === 'flashcards' || task.type === 'review') return 'tasks-review';
  if (task.type === 'prerequisite-repair') return 'tasks-prereq';
  if (task.type === 'mistake-retry' || task.category === 'fix') return 'tasks-fix';
  if (task.type === 'self-explanation' || task.type === 'comparison') return 'workspace';
  if (task.type === 'oral-exam' || task.type === 'deep-dive') return 'agent';
  return 'lesson';
}

export function getTaskConcept(task: Task): string {
  const fromTitle = task.title
    .replace(/^(Review|Lesson|Practice|Quiz|Concept Check|Retry Mistakes|Flashcard Review|Exam Simulation|Deep Dive|Self-Explain|Prerequisite Repair):\s*/i, '')
    .split('—')[0]
    ?.trim();
  return fromTitle || task.title;
}

export type WorkspaceToolId =
  | 'concept-map' | 'simulator' | 'leitner' | 'compare' | 'whiteboard'
  | 'feynman' | 'timer' | 'debate' | 'reader' | 'scratchpad' | 'annotations';

export function getWorkspaceTool(task: Task): WorkspaceToolId {
  if (task.type === 'self-explanation') return 'feynman';
  if (task.type === 'comparison') return 'compare';
  if (task.type === 'deep-dive') return 'reader';
  return 'concept-map';
}

/** @deprecated Prefer resolveReviewCards from taskFlowContent with upload context. */
export function getReviewCards(concept: string): { front: string; back: string }[] {
  return [
    { front: `Define: ${concept}`, back: `State the definition and key properties of ${concept} from your notes.` },
    { front: `Apply: ${concept}`, back: `How would you use ${concept} in a problem? Outline the steps.` },
  ];
}

export function getAgentMode(task: Task): AgentMode {
  if (task.type === 'oral-exam') return 'oral-exam';
  if (task.type === 'deep-dive') return 'deep-theory';
  if (task.type === 'mistake-retry') return 'error-diagnosis';
  return 'direct';
}

export function getMistakesForTask(task: Task, mistakes: MistakeRecord[]): MistakeRecord[] {
  const concept = getTaskConcept(task);
  const related = mistakes.filter((m) => !m.resolved && isSameConcept(m.concept, concept));
  if (related.length > 0) return related;
  if (task.category === 'fix') return mistakes.filter((m) => !m.resolved).slice(0, 3);
  return [];
}

export type ExamQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type PrerequisiteStep = {
  title: string;
  body: string;
};

/** Demo timer: ~6 seconds per estimated minute, capped at 5 min */
export function getExamDurationSeconds(estimatedMinutes: number): number {
  return Math.min(Math.max(estimatedMinutes * 6, 90), 300);
}

/** @deprecated Prefer resolveExamQuestions from taskFlowContent with upload context. */
export function getExamQuestions(concept: string): ExamQuestion[] {
  return [
    {
      question: `Which statement best describes ${concept}?`,
      options: ['The definition from your notes', 'An unrelated concept', 'The opposite idea', 'Only true in edge cases'],
      correctIndex: 0,
    },
    {
      question: `In a problem about ${concept}, what should you state first?`,
      options: ['Assumptions and definitions', 'Final numeric answer only', 'Unrelated formula', 'Graph with no explanation'],
      correctIndex: 0,
    },
  ];
}

/** @deprecated Prefer resolvePrerequisiteSteps from taskFlowContent with upload context. */
export function getPrerequisiteSteps(concept: string): PrerequisiteStep[] {
  return [
    {
      title: `Review: ${concept}`,
      body: `Strengthen the foundational ideas behind ${concept} before tackling dependent topics.`,
    },
    {
      title: 'Checkpoint',
      body: 'Complete the quick check below to confirm readiness for the main topic.',
    },
  ];
}

export function findPendingTask(tasks: Task[], predicate: (t: Task) => boolean): Task | undefined {
  return tasks.find((t) => t.status === 'pending' && predicate(t));
}

export function findTaskForRepair(tasks: Task[], repair: { concept: string; prerequisite: string }): Task | undefined {
  return (
    findPendingTask(
      tasks,
      (t) =>
        t.type === 'prerequisite-repair' &&
        (isSameConcept(getTaskConcept(t), repair.prerequisite) ||
          isSameConcept(getTaskConcept(t), repair.concept)),
    ) ?? findPendingTask(tasks, (t) => t.type === 'prerequisite-repair')
  );
}

export function findTaskForConcept(tasks: Task[], concept: string): Task | undefined {
  return findPendingTask(
    tasks,
    (t) =>
      isSameConcept(getTaskConcept(t), concept) || isSameConcept(t.title, concept),
  );
}

/** Filter pending tasks for a study session type */
export function filterTasksForSession(tasks: Task[], session: SessionType): Task[] {
  const pending = tasks.filter((t) => t.status === 'pending');

  switch (session) {
    case '10min':
      return [
        ...pending.filter((t) => t.isSpacedRepetition),
        ...pending.filter((t) => t.type === 'flashcards'),
        ...pending.filter((t) => t.type === 'concept-check'),
      ].slice(0, 4);
    case '25min':
      return pending
        .filter((t) => t.category === 'learn' || t.category === 'practice' || t.type === 'lesson')
        .slice(0, 4);
    case '50min':
      return pending
        .filter((t) => t.category === 'learn' || t.type === 'deep-dive' || t.type === 'exam-prep')
        .slice(0, 5);
    case 'cram':
      return pending
        .filter((t) => t.category === 'exam' || t.priority === 'critical' || t.priority === 'high')
        .slice(0, 6);
    case 'review':
      return pending.filter((t) => t.isSpacedRepetition || t.category === 'review');
    default:
      return pending.slice(0, 3);
  }
}

export function sessionLabel(session: SessionType): string {
  const labels: Record<SessionType, string> = {
    '10min': 'Quick Sprint',
    '25min': 'Focused Session',
    '50min': 'Deep Session',
    cram: 'Exam Cram',
    review: 'Spaced Review',
  };
  return labels[session];
}

export function startButtonLabel(task: Task): string {
  const action = getTaskAction(task);
  switch (action) {
    case 'practical': return 'Start Practice';
    case 'workspace': return 'Open Workspace';
    case 'agent': return 'Open Agent';
    case 'tasks-review': return 'Start Review';
    case 'tasks-fix': return 'Retry Mistakes';
    case 'tasks-prereq': return 'Start Repair';
    case 'exam-prep': return 'Start Exam Prep';
    default:
      if (task.type === 'quiz' || task.type === 'concept-check') return 'Take Quiz';
      if (task.type === 'exam-prep') return 'Start Exam Prep';
      return 'Start Lesson';
  }
}
