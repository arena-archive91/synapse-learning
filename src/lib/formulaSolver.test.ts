import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateFormulaExpression, inferVariablesFromFormula } from './formulaSolver';

describe('formulaSolver — evaluateExpression', () => {
  it('handles arithmetic and precedence', () => {
    expect(evaluateExpression('1 + 2 * 3')).toBe(7);
    expect(evaluateExpression('(1 + 2) * 3')).toBe(9);
    expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512); // right-assoc
    expect(evaluateExpression('10 / 2 / 5')).toBe(1);
  });

  it('handles unary minus / plus', () => {
    expect(evaluateExpression('-3 + 5')).toBe(2);
    expect(evaluateExpression('2 * -3')).toBe(-6);
    expect(evaluateExpression('-(2 + 3)')).toBe(-5);
    expect(evaluateExpression('+5')).toBe(5);
  });

  it('evaluates trig and log functions correctly', () => {
    expect(evaluateExpression('sin(0)')).toBe(0);
    expect(evaluateExpression('cos(0)')).toBe(1);
    expect(evaluateExpression('sqrt(16)')).toBe(4);
    expect(evaluateExpression('log(100)')).toBeCloseTo(2);
    expect(evaluateExpression('ln(e)', {})).toBeCloseTo(1);
  });

  it('supports constants pi and e', () => {
    expect(evaluateExpression('pi')).toBeCloseTo(Math.PI);
    expect(evaluateExpression('e')).toBeCloseTo(Math.E);
    expect(evaluateExpression('sin(pi/2)')).toBeCloseTo(1);
  });

  it('substitutes variables', () => {
    expect(evaluateExpression('m * c^2', { m: 2, c: 3 })).toBe(18);
    expect(evaluateExpression('a + b', { a: 1.5, b: 2.5 })).toBe(4);
  });

  it('throws on division by zero', () => {
    expect(() => evaluateExpression('5 / 0')).toThrow(/Division by zero/);
  });

  it('throws on unknown variable', () => {
    expect(() => evaluateExpression('x + 1')).toThrow(/Unknown variable/);
  });
});

describe('formulaSolver — evaluateFormulaExpression', () => {
  it('returns result and steps for a labelled formula', () => {
    const out = evaluateFormulaExpression('F = m * a', [
      { symbol: 'm', value: '5', unit: 'kg' },
      { symbol: 'a', value: '2', unit: 'm/s²' },
    ]);
    expect(out.result).toBe(10);
    expect(out.steps[0]).toContain('F = m * a');
  });

  it('handles trig formulas without silently evaluating to 0', () => {
    const out = evaluateFormulaExpression('y = sin(x) + cos(x)', [
      { symbol: 'x', value: '0', unit: '' },
    ]);
    expect(out.result).toBe(1);
  });

  it('flags missing variable values', () => {
    const out = evaluateFormulaExpression('y = 2 * x', [{ symbol: 'x', value: '', unit: '' }]);
    expect(out.result).toBeNull();
    expect(out.steps[0]).toMatch(/Fill in/);
  });

  it('flags non-numeric values', () => {
    const out = evaluateFormulaExpression('y = 2 * x', [{ symbol: 'x', value: 'abc', unit: '' }]);
    expect(out.result).toBeNull();
    expect(out.steps[0]).toMatch(/not a number/);
  });
});

describe('formulaSolver — inferVariablesFromFormula', () => {
  it('extracts variables from RHS but skips function names', () => {
    const vars = inferVariablesFromFormula('y = sin(x) + cos(t)');
    const symbols = vars.map((v) => v.symbol).sort();
    expect(symbols).toEqual(['t', 'x']);
  });

  it('skips constants pi and e', () => {
    const vars = inferVariablesFromFormula('A = pi * r^2');
    expect(vars.map((v) => v.symbol)).toEqual(['r']);
  });

  it('falls back to x when no variables present', () => {
    const vars = inferVariablesFromFormula('y = 5');
    expect(vars.map((v) => v.symbol)).toEqual(['x']);
  });
});
