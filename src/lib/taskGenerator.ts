import type { Course, Task } from '../types';
import { isDemoCourse } from './demoMode';

function mkTask(
  id: string,
  title: string,
  desc: string,
  type: Task['type'],
  course: Course,
  topicTitle: string,
  priority: Task['priority'],
  mins: number,
  xp: number,
  category: Task['category'],
  tags: string[],
  extra?: Partial<Task>,
): Task {
  return {
    id,
    title,
    description: desc,
    type,
    courseId: course.id,
    courseName: course.title,
    courseColor: course.color,
    courseIcon: course.icon,
    priority,
    estimatedMinutes: mins,
    xpReward: xp,
    isSpacedRepetition: false,
    status: 'pending',
    category,
    tags: [...tags, topicTitle.toLowerCase().replace(/\s+/g, '-')],
    ...extra,
  };
}

/**
 * Derive study tasks from a user-generated course outline (topics + key concepts).
 * Replaces mock task lists when material is uploaded.
 */
export function generateTasksFromCourse(course: Course): Task[] {
  const tasks: Task[] = [];
  const ready = course.status !== 'generating';

  course.topics.forEach((topic, idx) => {
    const concept = topic.keyConcepts?.[0] ?? topic.title;
    const mins = Math.max(8, Math.min(30, topic.estimatedMinutes || 15));

    if (ready) {
      tasks.push(mkTask(
        `gen-${course.id}-lesson-${topic.id}`,
        `Lesson: ${topic.title}`,
        topic.description || `Study ${topic.title} from your uploaded material.`,
        'lesson',
        course,
        topic.title,
        idx === 0 ? 'high' : 'medium',
        mins,
        40 + idx * 5,
        'learn',
        ['lesson', 'generated'],
      ));

      if (topic.keyConcepts && topic.keyConcepts.length > 0) {
        tasks.push(mkTask(
          `gen-${course.id}-workspace-${topic.id}`,
          `Study Workspace: ${concept}`,
          `Interactive study — concept map, flashcards, and recall from your notes.`,
          'self-explanation',
          course,
          topic.title,
          'medium',
          Math.max(12, mins),
          50,
          'practice',
          ['workspace', 'generated'],
        ));
      }

      if ((topic.objectives?.length ?? 0) > 0 || idx % 2 === 1) {
        tasks.push(mkTask(
          `gen-${course.id}-review-${topic.id}`,
          `Review: ${topic.title}`,
          `Spaced recall for concepts in ${topic.title}.`,
          'flashcards',
          course,
          topic.title,
          'medium',
          Math.max(6, Math.floor(mins / 2)),
          25,
          'review',
          ['review', 'generated'],
          { isSpacedRepetition: true },
        ));
      }
    }
  });

  if (ready && course.examDate) {
    tasks.push(mkTask(
      `gen-${course.id}-exam`,
      `Exam prep: ${course.title}`,
      `Review all topics before your exam.`,
      'exam-prep',
      course,
      course.title,
      'high',
      30,
      80,
      'exam',
      ['exam', 'generated'],
      { dueAt: course.examDate },
    ));
  }

  return tasks;
}

export function mergeCourseTasks(existing: Task[], course: Course): Task[] {
  const prefix = `gen-${course.id}-`;
  const without = existing.filter((t) => !t.id.startsWith(prefix) && t.courseId !== course.id);
  return [...without, ...generateTasksFromCourse(course)];
}

export function mergeAllGeneratedTasks(existing: Task[], courses: Course[]): Task[] {
  const userCourses = courses.filter((c) => !isDemoCourse(c.id));
  let next = existing.filter((t) => !t.id.startsWith('gen-'));
  for (const course of userCourses) {
    if (course.status === 'generating') continue;
    next = mergeCourseTasks(next, course);
  }
  return next;
}
