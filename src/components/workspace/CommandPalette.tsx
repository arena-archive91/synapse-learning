import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  group?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

/**
 * Lightweight, dependency-free command palette.
 *
 * - Opens via parent shortcut (⌘K / Ctrl+K) — keyboard handling lives at
 *   parent level so the palette can be reused from any host.
 * - Filters by token-AND match across `label` + `group` + `hint` so users
 *   can type partial words ("focus tool", "swap pane", …).
 * - Up/Down/Enter for keyboard nav; Escape closes.
 *
 * Why custom (instead of e.g. cmdk): we already ship a tiny bundle and
 * adding another React tree just for this widget is unjustified — the
 * surface here is < 90 lines.
 */
export function CommandPalette({ open, onClose, items, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return;
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      const hay = `${it.label} ${it.group ?? ''} ${it.hint ?? ''}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [query, items]);

  // Group filtered items but preserve the input order within each group.
  const grouped = useMemo(() => {
    const out = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const k = it.group ?? '';
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(it);
    }
    return [...out.entries()];
  }, [filtered]);

  // Build a flat list (ordering must match the rendered order so that
  // keyboard-nav indices line up with what the user sees).
  const flat = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);

  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[active];
      if (item) {
        item.run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-bg-1 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} className="text-text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder={placeholder ?? 'Type a command, tool, or layout…'}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-text-muted hover:bg-white/10 hover:text-text-secondary"
                aria-label="Close command palette"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-text-muted">No matches</div>
              ) : (
                grouped.map(([group, list]) => (
                  <div key={group || 'default'} className="mb-1 last:mb-0">
                    {group && (
                      <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                        {group}
                      </div>
                    )}
                    {list.map((it) => {
                      const idx = flat.indexOf(it);
                      const isActive = idx === active;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => {
                            it.run();
                            onClose();
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                            isActive
                              ? 'bg-accent-bright/15 text-text-primary'
                              : 'text-text-secondary hover:bg-white/5',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{it.label}</div>
                            {it.hint && (
                              <div className="truncate text-[11px] text-text-muted">{it.hint}</div>
                            )}
                          </div>
                          {it.shortcut && (
                            <span className="shrink-0 rounded border border-border bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                              {it.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border px-4 py-2 text-[10px] text-text-muted">
              ↑ ↓ navigate · Enter run · Esc close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
