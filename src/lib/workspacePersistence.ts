import { loadJson, saveJson } from './persistence';

type MapNodeSave = { x: number; y: number; note?: string };

const MAP_KEY = 'concept-map-positions';
const WORKSPACE_KEY = 'workspace-progress';
const NOTES_KEY = 'workspace-notes';
const WHITEBOARD_KEY = 'whiteboard-strokes';
const SCRATCHPAD_KEY = 'scratchpad-formulas';

/**
 * Concept-map node positions, scoped per workspace key (task / concept).
 * Earlier MVP used a single global key, so positions bled across tasks; the
 * `scope` parameter keys an inner record so each workspace gets its own
 * layout. Falls back to the legacy global record when no scope is supplied.
 */
export function loadConceptMapPositions<T extends { id: string; x: number; y: number; note?: string }>(
  fallback: T[],
  scope?: string,
): T[] {
  const all = loadJson<Record<string, Record<string, MapNodeSave>>>(MAP_KEY, {});
  const saved = scope ? (all[scope] ?? {}) : (all['__global'] ?? {});
  if (Object.keys(saved).length === 0) return fallback;
  return fallback.map((n) => (saved[n.id] ? { ...n, ...saved[n.id] } : n));
}

export function saveConceptMapPositions(
  nodes: { id: string; x: number; y: number; note?: string }[],
  scope?: string,
): void {
  const all = loadJson<Record<string, Record<string, MapNodeSave>>>(MAP_KEY, {});
  const slot = scope ?? '__global';
  all[slot] = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, note: n.note }]));
  saveJson(MAP_KEY, all);
}

export function loadWorkspaceStep(key: string): number {
  return loadJson<Record<string, number>>(WORKSPACE_KEY, {})[key] ?? 0;
}

export function saveWorkspaceStep(key: string, step: number): void {
  const store = loadJson<Record<string, number>>(WORKSPACE_KEY, {});
  store[key] = step;
  saveJson(WORKSPACE_KEY, store);
}

/** Per-session study notes, persisted locally and keyed by workspace/task. */
export function loadWorkspaceNotes(key: string): string {
  return loadJson<Record<string, string>>(NOTES_KEY, {})[key] ?? '';
}

export function saveWorkspaceNotes(key: string, notes: string): void {
  const store = loadJson<Record<string, string>>(NOTES_KEY, {});
  if (notes.trim()) store[key] = notes;
  else delete store[key];
  saveJson(NOTES_KEY, store);
}

/* ------------------------------------------------------------------ *
 * Whiteboard strokes (scoped) — used by StudyWhiteboard.
 * Stores an opaque payload (strokes) per workspace key so that each task
 * has its own board instead of a single global one.
 * ------------------------------------------------------------------ */
export function loadWhiteboardStrokes<T = unknown>(scope: string): T | null {
  const all = loadJson<Record<string, T>>(WHITEBOARD_KEY, {});
  return all[scope] ?? null;
}

export function saveWhiteboardStrokes<T>(scope: string, strokes: T): void {
  const all = loadJson<Record<string, T>>(WHITEBOARD_KEY, {});
  all[scope] = strokes;
  saveJson(WHITEBOARD_KEY, all);
}

/* ------------------------------------------------------------------ *
 * Scratchpad formulas (scoped) — used by FormulaScratchpad.
 * ------------------------------------------------------------------ */
export function loadScratchpadFormulas<T = unknown>(scope: string): T | null {
  const all = loadJson<Record<string, T>>(SCRATCHPAD_KEY, {});
  return all[scope] ?? null;
}

export function saveScratchpadFormulas<T>(scope: string, formulas: T): void {
  const all = loadJson<Record<string, T>>(SCRATCHPAD_KEY, {});
  all[scope] = formulas;
  saveJson(SCRATCHPAD_KEY, all);
}
