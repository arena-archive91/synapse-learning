/**
 * Build prerequisite edges from generated courses (the user's actual material)
 * instead of the hardcoded ECON_CONCEPT_EDGES, which was leaking demo content
 * into the production prerequisite-repair feature.
 *
 * Each Course.topic carries a `prerequisites: string[]` field; we resolve
 * those titles back to topic titles to form a directed prereq graph that is
 * actually grounded in the learner's notes.
 */
import type { Course } from '../types';

export type PrereqEdge = { prerequisite: string; dependent: string };

/** Normalize a topic title for case/whitespace insensitive matching. */
function key(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build prerequisite edges from the topics of the supplied courses.
 *
 * Behaviour:
 *   - Resolves prerequisite strings against the union of topic titles across
 *     all courses (case-insensitive) so courses that reference each other's
 *     topics still produce edges.
 *   - Skips self-loops and duplicates.
 *   - Returns an empty array if no valid prerequisites are present, so callers
 *     can decide whether to fall back to a domain-specific seed (e.g. demo).
 */
export function edgesFromCourses(courses: Course[]): PrereqEdge[] {
  if (!courses || courses.length === 0) return [];
  const titleByKey = new Map<string, string>();
  for (const c of courses) {
    if (c.status === 'generating') continue;
    for (const t of c.topics) {
      const k = key(t.title);
      if (k && !titleByKey.has(k)) titleByKey.set(k, t.title);
    }
  }
  const edges: PrereqEdge[] = [];
  const seen = new Set<string>();
  for (const c of courses) {
    if (c.status === 'generating') continue;
    for (const t of c.topics) {
      const depKey = key(t.title);
      const depTitle = titleByKey.get(depKey);
      if (!depTitle) continue;
      for (const pre of t.prerequisites ?? []) {
        const preKey = key(pre);
        if (!preKey || preKey === depKey) continue;
        const preTitle = titleByKey.get(preKey);
        if (!preTitle) continue;
        const sig = `${preKey}→${depKey}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        edges.push({ prerequisite: preTitle, dependent: depTitle });
      }
    }
  }
  return edges;
}
