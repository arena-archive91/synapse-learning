/**
 * Generic, safe formula evaluator (no `eval` / `Function`).
 *
 * Supported syntax:
 *   - operators: +  -  *  /  ^  unary -  unary +
 *   - parentheses
 *   - functions: sin, cos, tan, asin, acos, atan, log (log10), ln (loge),
 *     exp, sqrt, abs, max, min, round, floor, ceil
 *   - constants: pi, e
 *   - identifiers: any [a-zA-Z][a-zA-Z0-9_]* not in the function/constant set
 *
 * Features beyond the previous MVP:
 *   - Unary minus / plus (so `-x + 3` and `2*-3` evaluate correctly)
 *   - Real implementations of sin/cos/log/sqrt etc. (used to silently → 0)
 *   - Right-associative power operator
 *   - Friendly, structured error messages instead of "could not evaluate"
 *   - Captures the unit on the LHS variable for nicer result rendering
 */

export type FormulaVariable = { symbol: string; value: string; unit: string };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: (x: number) => Math.log10(x),
  ln: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  max: (...args: number[]) => Math.max(...args),
  min: (...args: number[]) => Math.min(...args),
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

export function inferVariablesFromFormula(formula: string): FormulaVariable[] {
  const rhs = formula.includes('=') ? formula.split('=').slice(1).join('=') : formula;
  const tokens = rhs.match(/[a-zA-Z][a-zA-Z0-9_]*/g) ?? [];
  const skip = new Set([...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)]);
  const seen = new Set<string>();
  const out: FormulaVariable[] = [];
  for (const tok of tokens) {
    if (skip.has(tok.toLowerCase())) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push({ symbol: tok, value: '', unit: '' });
  }
  return out.length > 0 ? out : [{ symbol: 'x', value: '', unit: '' }];
}

type Tok =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'unary'; value: 'u-' | 'u+' }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'fn'; value: string };

function tokenize(expr: string): Tok[] {
  const cleaned = expr.replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  const peek = (): Tok | undefined => out[out.length - 1];
  const isUnaryContext = () => {
    const p = peek();
    if (!p) return true;
    return p.kind === 'op' || p.kind === 'lparen' || p.kind === 'comma' || p.kind === 'unary' || p.kind === 'fn';
  };

  while (i < cleaned.length) {
    const ch = cleaned[i]!;

    if (ch === '(') { out.push({ kind: 'lparen' }); i++; continue; }
    if (ch === ')') { out.push({ kind: 'rparen' }); i++; continue; }
    if (ch === ',') { out.push({ kind: 'comma' }); i++; continue; }

    if ('+-*/^'.includes(ch)) {
      if ((ch === '-' || ch === '+') && isUnaryContext()) {
        out.push({ kind: 'unary', value: ch === '-' ? 'u-' : 'u+' });
      } else {
        out.push({ kind: 'op', value: ch as '+' | '-' | '*' | '/' | '^' });
      }
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i]!)) {
        num += cleaned[i]!;
        i++;
      }
      // scientific notation: 1.2e-3
      if (i < cleaned.length && (cleaned[i] === 'e' || cleaned[i] === 'E')) {
        num += cleaned[i]!;
        i++;
        if (i < cleaned.length && (cleaned[i] === '+' || cleaned[i] === '-')) {
          num += cleaned[i]!;
          i++;
        }
        while (i < cleaned.length && /[0-9]/.test(cleaned[i]!)) {
          num += cleaned[i]!;
          i++;
        }
      }
      const v = parseFloat(num);
      if (Number.isNaN(v)) throw new Error(`Bad number: ${num}`);
      out.push({ kind: 'num', value: v });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < cleaned.length && /[a-zA-Z0-9_]/.test(cleaned[i]!)) {
        id += cleaned[i]!;
        i++;
      }
      const lower = id.toLowerCase();
      if (FUNCTIONS[lower] && cleaned[i] === '(') {
        out.push({ kind: 'fn', value: lower });
      } else if (CONSTANTS[lower] !== undefined) {
        out.push({ kind: 'num', value: CONSTANTS[lower] });
      } else {
        out.push({ kind: 'ident', value: id });
      }
      continue;
    }

    throw new Error(`Unexpected character "${ch}"`);
  }
  return out;
}

function precedence(op: string): number {
  switch (op) {
    case '^': return 4;
    case 'u-': return 4;
    case 'u+': return 4;
    case '*': case '/': return 3;
    case '+': case '-': return 2;
    default: return 0;
  }
}

const RIGHT_ASSOC = new Set(['^', 'u-', 'u+']);

type RpnTok =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'unary'; value: 'u-' | 'u+' }
  | { kind: 'fn'; value: string; argc: number };

function toRpn(tokens: Tok[]): RpnTok[] {
  const out: RpnTok[] = [];
  type StackItem =
    | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' }
    | { kind: 'unary'; value: 'u-' | 'u+' }
    | { kind: 'lparen' }
    | { kind: 'fn'; value: string; argc: number };
  const stack: StackItem[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.kind === 'num') {
      out.push({ kind: 'num', value: t.value });
    } else if (t.kind === 'ident') {
      out.push({ kind: 'ident', value: t.value });
    } else if (t.kind === 'fn') {
      stack.push({ kind: 'fn', value: t.value, argc: 1 });
    } else if (t.kind === 'comma') {
      while (stack.length && stack[stack.length - 1]!.kind !== 'lparen') {
        const top = stack.pop()!;
        if (top.kind === 'op') out.push({ kind: 'op', value: top.value });
        else if (top.kind === 'unary') out.push({ kind: 'unary', value: top.value });
      }
      // bump arity of enclosing function
      for (let j = stack.length - 1; j >= 0; j--) {
        const f = stack[j]!;
        if (f.kind === 'fn') { f.argc += 1; break; }
        if (f.kind === 'lparen') break;
      }
    } else if (t.kind === 'op' || t.kind === 'unary') {
      const opSym = t.value;
      const opPrec = precedence(opSym);
      while (stack.length) {
        const top = stack[stack.length - 1]!;
        if (top.kind === 'lparen' || top.kind === 'fn') break;
        const topSym = top.kind === 'op' ? top.value : top.value;
        const topPrec = precedence(topSym);
        if (topPrec > opPrec || (topPrec === opPrec && !RIGHT_ASSOC.has(opSym))) {
          if (top.kind === 'op') out.push({ kind: 'op', value: top.value });
          else if (top.kind === 'unary') out.push({ kind: 'unary', value: top.value });
          stack.pop();
        } else {
          break;
        }
      }
      if (t.kind === 'op') stack.push({ kind: 'op', value: t.value });
      else stack.push({ kind: 'unary', value: t.value });
    } else if (t.kind === 'lparen') {
      stack.push({ kind: 'lparen' });
    } else if (t.kind === 'rparen') {
      while (stack.length && stack[stack.length - 1]!.kind !== 'lparen') {
        const top = stack.pop()!;
        if (top.kind === 'op') out.push({ kind: 'op', value: top.value });
        else if (top.kind === 'unary') out.push({ kind: 'unary', value: top.value });
      }
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop(); // discard '('
      if (stack.length && stack[stack.length - 1]!.kind === 'fn') {
        const fn = stack.pop() as { kind: 'fn'; value: string; argc: number };
        out.push({ kind: 'fn', value: fn.value, argc: fn.argc });
      }
    }
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === 'lparen') throw new Error('Mismatched parentheses');
    if (top.kind === 'op') out.push({ kind: 'op', value: top.value });
    else if (top.kind === 'unary') out.push({ kind: 'unary', value: top.value });
    else if (top.kind === 'fn') out.push({ kind: 'fn', value: top.value, argc: top.argc });
  }
  return out;
}

function evalRpn(rpn: RpnTok[], variables: Record<string, number>): number {
  const stack: number[] = [];
  for (const tok of rpn) {
    if (tok.kind === 'num') {
      stack.push(tok.value);
    } else if (tok.kind === 'ident') {
      const v = variables[tok.value];
      if (v === undefined || Number.isNaN(v)) {
        throw new Error(`Unknown variable "${tok.value}"`);
      }
      stack.push(v);
    } else if (tok.kind === 'unary') {
      const a = stack.pop();
      if (a === undefined) throw new Error('Bad expression');
      stack.push(tok.value === 'u-' ? -a : +a);
    } else if (tok.kind === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Bad expression');
      switch (tok.value) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b);
          break;
        case '^': stack.push(Math.pow(a, b)); break;
      }
    } else if (tok.kind === 'fn') {
      const fn = FUNCTIONS[tok.value];
      if (!fn) throw new Error(`Unknown function "${tok.value}"`);
      const args: number[] = [];
      for (let i = 0; i < tok.argc; i++) {
        const v = stack.pop();
        if (v === undefined) throw new Error('Bad function call');
        args.unshift(v);
      }
      const res = fn(...args);
      if (Number.isNaN(res) || !Number.isFinite(res)) {
        throw new Error(`${tok.value}() produced ${String(res)}`);
      }
      stack.push(res);
    }
  }
  if (stack.length !== 1) throw new Error('Bad expression');
  return stack[0]!;
}

/**
 * Pure helper — evaluate an arbitrary expression with bound variables.
 * Throws on parse / runtime errors. Useful for tests and by other callers.
 */
export function evaluateExpression(expression: string, variables: Record<string, number> = {}): number {
  const tokens = tokenize(expression);
  const rpn = toRpn(tokens);
  return evalRpn(rpn, variables);
}

function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return n.toFixed(6).replace(/\.?0+$/, '');
}

export function evaluateFormulaExpression(
  formula: string,
  variables: FormulaVariable[],
): { steps: string[]; result: number | null; unit?: string } {
  const parts = formula.split('=');
  const lhs = parts[0]?.trim() ?? 'result';
  const rhs = parts.slice(1).join('=').trim() || formula;
  const values: Record<string, number> = {};
  for (const v of variables) {
    const trimmed = v.value.trim();
    if (trimmed === '') {
      return { steps: ['⚠ Fill in all variables first.'], result: null };
    }
    const n = parseFloat(trimmed);
    if (Number.isNaN(n)) {
      return { steps: [`⚠ "${v.symbol}" is not a number.`], result: null };
    }
    values[v.symbol] = n;
  }

  // For the substitution step we only replace bare identifiers (not function names)
  const knownFns = new Set(Object.keys(FUNCTIONS));
  const substituted = rhs.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (m) => {
    if (knownFns.has(m.toLowerCase())) return m;
    if (CONSTANTS[m.toLowerCase()] !== undefined) return formatNumber(CONSTANTS[m.toLowerCase()]!);
    return values[m] !== undefined ? formatNumber(values[m]!) : m;
  });

  let result: number;
  try {
    result = evaluateExpression(rhs, values);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { steps: [`⚠ ${msg}`], result: null };
  }

  // If the LHS is a simple variable like "x" or "F" we look up its unit from
  // the user-provided variable rows, otherwise we leave it blank.
  const lhsVar = variables.find((v) => v.symbol === lhs);
  const unit = lhsVar?.unit?.trim() || '';
  const formatted = formatNumber(result);
  const tail = unit ? `${formatted} ${unit}` : formatted;
  const steps = [
    `Step 1: ${lhs} = ${rhs}`,
    `Step 2: Substitute → ${substituted}`,
    `Step 3: Result = ${formatted}`,
    `✓ ${lhs} = ${tail}`,
  ];
  return { steps, result, unit: unit || undefined };
}
