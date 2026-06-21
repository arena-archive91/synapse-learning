/**
 * Heavy Mermaid renderer — imported only via the lazy `MermaidDiagram` wrapper,
 * so the (large) Mermaid engine is fetched/parsed the first time a diagram is
 * actually shown, not on initial load.
 */
import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

let initialized = false;
let counter = 0;

function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict',
    fontFamily: 'inherit',
  });
  initialized = true;
}

export default function MermaidDiagramInner({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureInit();
    const id = `mmd-${Date.now()}-${counter++}`;
    mermaid
      .render(id, code)
      .then(({ svg: out }) => {
        if (!cancelled) setSvg(out);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed) {
    return (
      <pre className="my-2 p-3 rounded-lg bg-surface-hover overflow-x-auto text-[0.8em] font-mono">
        <code>{code}</code>
      </pre>
    );
  }
  if (!svg) {
    return <div className="my-2 text-xs text-text-muted">Rendering diagram…</div>;
  }
  return <div className="my-3 flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}
