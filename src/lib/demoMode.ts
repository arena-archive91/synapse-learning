import type { Course, Task, UserSettings } from '../types';

/** Demo seed IDs — never treat as user-generated content. */
export const MOCK_COURSE_IDS = new Set(['c1', 'c2', 'c3', 'c4']);
export const MOCK_TASK_IDS = new Set([
  'task1', 'task2', 'task3', 'task4', 'task5',
  'task6', 'task7', 'task8', 'task9', 'task10',
]);

export function shouldShowDemo(settings: UserSettings): boolean {
  return settings.showDemoContent === true;
}

export function isDemoCourse(id: string): boolean {
  return MOCK_COURSE_IDS.has(id);
}

export function isDemoTask(id: string): boolean {
  return MOCK_TASK_IDS.has(id);
}

export function visibleCourses(courses: Course[], settings: UserSettings): Course[] {
  if (shouldShowDemo(settings)) return courses;
  return courses.filter((c) => !isDemoCourse(c.id));
}

export function visibleTasks(tasks: Task[], settings: UserSettings): Task[] {
  if (shouldShowDemo(settings)) return tasks;
  return tasks.filter((t) => !isDemoTask(t.id));
}

export function initialCourses(
  generated: Course[],
  settings: UserSettings,
  mockCourses: Course[],
): Course[] {
  return shouldShowDemo(settings) ? [...mockCourses, ...generated] : generated;
}

export function stripDemoFromTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isDemoTask(t.id));
}
