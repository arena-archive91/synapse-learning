import type { Course, GlossaryEntry, UploadedFile } from '../types';
import { loadJson, saveJson } from './persistence';
import { idbLoadText, idbSaveText, shouldOffloadText } from './indexedDbStorage';

const LIBRARY_KEY = 'library-v1';

export type PersistedLibrary = {
  uploadedFiles: UploadedFile[];
  glossaryEntries: GlossaryEntry[];
  generatedCourses: Course[];
};

type SlimUploadedFile = UploadedFile & { textOffloaded?: boolean };

export function loadLibrarySync(): PersistedLibrary {
  return loadJson<PersistedLibrary>(LIBRARY_KEY, {
    uploadedFiles: [],
    glossaryEntries: [],
    generatedCourses: [],
  });
}

/** Hydrate offloaded extractedText from IndexedDB after sync load. */
export async function hydrateLibrary(lib: PersistedLibrary): Promise<PersistedLibrary> {
  const files = await Promise.all(
    lib.uploadedFiles.map(async (f) => {
      const slim = f as SlimUploadedFile;
      if (f.extractedText?.trim()) return f;
      if (slim.textOffloaded || !f.extractedText) {
        const text = await idbLoadText(f.id);
        if (text) return { ...f, extractedText: text };
      }
      return f;
    }),
  );
  return { ...lib, uploadedFiles: files };
}

export function saveLibrarySync(lib: PersistedLibrary): void {
  const offloads: Array<{ id: string; text: string }> = [];
  const slimFiles = lib.uploadedFiles.map((f) => {
    if (shouldOffloadText(f.extractedText)) {
      offloads.push({ id: f.id, text: f.extractedText! });
      const { extractedText: _, ...rest } = f;
      return { ...rest, textOffloaded: true } as SlimUploadedFile;
    }
    return f;
  });

  try {
    saveJson(LIBRARY_KEY, {
      uploadedFiles: slimFiles,
      glossaryEntries: lib.glossaryEntries,
      generatedCourses: lib.generatedCourses,
    });
  } catch {
    // If localStorage full, still try IDB for all texts
    for (const f of lib.uploadedFiles) {
      if (f.extractedText) offloads.push({ id: f.id, text: f.extractedText });
    }
  }

  for (const { id, text } of offloads) {
    void idbSaveText(id, text);
  }
}
