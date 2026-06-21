const STORAGE_PREFIX = 'synapse:';
const BACKUP_VERSION = 2;

export type SessionBackup = {
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
};

export function exportAllSessionData(): string {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      data[key.slice(STORAGE_PREFIX.length)] = raw ? JSON.parse(raw) : null;
    } catch {
      data[key.slice(STORAGE_PREFIX.length)] = localStorage.getItem(key);
    }
  }
  const backup: SessionBackup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export function importSessionData(json: string): { ok: true; keysImported: number } | { ok: false; error: string } {
  let parsed: SessionBackup;
  try {
    parsed = JSON.parse(json) as SessionBackup;
  } catch {
    return { ok: false, error: 'Invalid JSON file.' };
  }
  if (!parsed?.data || typeof parsed.data !== 'object') {
    return { ok: false, error: 'Backup format not recognized.' };
  }
  let count = 0;
  for (const [key, value] of Object.entries(parsed.data)) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, typeof value === 'string' ? value : JSON.stringify(value));
      count++;
    } catch {
      return { ok: false, error: 'Storage full or unavailable while importing.' };
    }
  }
  return { ok: true, keysImported: count };
}

export function clearAllSessionData(): number {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys.length;
}

export function downloadBackup(filename?: string): void {
  const blob = new Blob([exportAllSessionData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `synapse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
