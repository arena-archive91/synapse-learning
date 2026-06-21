import { config } from '../config';
import { createLibraryRepo } from './postgres';

export type StoredLibrary = {
  uploadedFiles: unknown[];
  glossaryEntries: unknown[];
  generatedCourses: unknown[];
  updatedAt: string;
};

const memory = new Map<string, StoredLibrary>();
const pgRepo = createLibraryRepo(config.databaseUrl);

export function getLibrary(accountId: string): StoredLibrary {
  if (pgRepo) {
    throw new Error('Use getLibraryAsync when DATABASE_URL is configured');
  }
  return memory.get(accountId) ?? {
    uploadedFiles: [],
    glossaryEntries: [],
    generatedCourses: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getLibraryAsync(accountId: string): Promise<StoredLibrary> {
  if (pgRepo) return pgRepo.getLibrary(accountId);
  return getLibrary(accountId);
}

export function saveLibrary(accountId: string, data: Omit<StoredLibrary, 'updatedAt'>): StoredLibrary {
  if (pgRepo) {
    throw new Error('Use saveLibraryAsync when DATABASE_URL is configured');
  }
  const saved: StoredLibrary = { ...data, updatedAt: new Date().toISOString() };
  memory.set(accountId, saved);
  return saved;
}

export async function saveLibraryAsync(
  accountId: string,
  data: Omit<StoredLibrary, 'updatedAt'>,
): Promise<StoredLibrary> {
  if (pgRepo) return pgRepo.saveLibrary(accountId, data);
  return saveLibrary(accountId, data);
}
