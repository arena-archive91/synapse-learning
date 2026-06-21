/**
 * MermaidDiagram — lazy wrapper. Shows the raw diagram source as a code block
 * until the Mermaid engine loads and renders, and falls back to it permanently
 * if rendering ever throws.
 */
import { Suspense, lazy, Component, type ReactNode } from 'react';

const MermaidDiagramInner = lazy(() => import('./MermaidDiagramInner'));

class DiagramBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MermaidDiagram({ code }: { code: string }) {
  const fallback = (
    <pre className="my-2 p-3 rounded-lg bg-surface-hover overflow-x-auto text-[0.8em] font-mono">
      <code>{code}</code>
    </pre>
  );
  return (
    <DiagramBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <MermaidDiagramInner code={code} />
      </Suspense>
    </DiagramBoundary>
  );
}
