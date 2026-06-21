/**
 * CodeEditor — lazy wrapper around CodeMirror.
 *
 * Renders a plain <textarea> immediately (and as a permanent fallback if the
 * editor fails to load), then upgrades to a full CodeMirror editor with Python
 * syntax highlighting, line numbers, and bracket matching once it has loaded.
 * The heavy editor code is split into `CodeEditorInner` and only fetched the
 * first time an editor mounts.
 */
import { Suspense, lazy, Component, type ReactNode } from 'react';

const CodeEditorInner = lazy(() => import('./CodeEditorInner'));

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
}

function PlainEditor({ value, onChange, readOnly, className }: CodeEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      className={
        className ??
        'w-full h-full p-4 bg-[#0d0b14] text-sm font-mono text-accent-emerald focus:outline-none resize-none leading-relaxed'
      }
    />
  );
}

/** If CodeMirror throws at runtime, fall back to the textarea instead of crashing. */
class EditorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CodeEditor(props: CodeEditorProps) {
  const fallback = <PlainEditor {...props} />;
  return (
    <EditorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <CodeEditorInner
          value={props.value}
          onChange={props.onChange}
          height={props.height}
          readOnly={props.readOnly}
        />
      </Suspense>
    </EditorBoundary>
  );
}
