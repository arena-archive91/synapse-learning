import type { Course, GlossaryEntry, UploadedFile } from '../types';
import { normalizeConcept } from './contentAnalysis';
import type { PersistedLibrary } from './libraryStorage';

/** Merge remote library into local — remote entries win on id/title conflicts. */
export function mergeLibraries(local: PersistedLibrary, remote: PersistedLibrary): PersistedLibrary {
  const fileMap = new Map(local.uploadedFiles.map((f) => [f.id, f]));
  for (const f of remote.uploadedFiles) {
    fileMap.set(f.id, f);
  }

  const glossaryMap = new Map(
    local.glossaryEntries.map((g) => [`${g.courseId ?? ''}:${normalizeConcept(g.term)}`, g]),
  );
  for (const g of remote.glossaryEntries) {
    glossaryMap.set(`${g.courseId ?? ''}:${normalizeConcept(g.term)}`, g);
  }

  const courseMap = new Map(local.generatedCourses.map((c) => [c.id, c]));
  for (const c of remote.generatedCourses) {
    const existing = courseMap.get(c.id);
    if (!existing) {
      courseMap.set(c.id, c);
      continue;
    }
    courseMap.set(c.id, {
      ...existing,
      ...c,
      topics: mergeTopics(existing.topics, c.topics),
      sourceFiles: [...new Set([...existing.sourceFiles, ...c.sourceFiles])],
    });
  }

  return {
    uploadedFiles: [...fileMap.values()],
    glossaryEntries: [...glossaryMap.values()],
    generatedCourses: [...courseMap.values()],
  };
}

function mergeTopics(existing: Course['topics'], incoming: Course['topics']): Course['topics'] {
  const map = new Map(existing.map((t) => [normalizeConcept(t.title), t]));
  for (const t of incoming) {
    const key = normalizeConcept(t.title);
    if (!map.has(key)) map.set(key, t);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

export function remoteLibraryToPersisted(remote: {
  uploadedFiles?: unknown[];
  glossaryEntries?: unknown[];
  generatedCourses?: unknown[];
}): PersistedLibrary {
  return {
    uploadedFiles: (remote.uploadedFiles ?? []) as UploadedFile[],
    glossaryEntries: (remote.glossaryEntries ?? []) as GlossaryEntry[],
    generatedCourses: (remote.generatedCourses ?? []) as Course[],
  };
}
