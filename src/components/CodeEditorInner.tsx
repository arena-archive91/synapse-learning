/**
 * Heavy CodeMirror editor — imported only via the lazy `CodeEditor` wrapper so
 * the editor (and its grammar) is never parsed until a code cell is shown.
 */
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';

export interface CodeEditorInnerProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

export default function CodeEditorInner({ value, onChange, height = '100%', readOnly = false }: CodeEditorInnerProps) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme="dark"
      readOnly={readOnly}
      extensions={[python()]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        indentOnInput: true,
        tabSize: 4,
      }}
      style={{ fontSize: 13, height: '100%' }}
    />
  );
}
