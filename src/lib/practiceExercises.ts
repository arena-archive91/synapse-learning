import type { Lang } from './i18n';
import type { Course, GlossaryEntry, UploadedFile } from '../types';
import {
  extractFormulas,
  extractWorkedExamples,
  gatherAnalyzedText,
  relevantExcerpt,
} from './noteContentExtractors';

export type CodeExercise = {
  id: string;
  title: string;
  objective: string;
  starterCode: string;
  hints: string[];
  solution: string;
  validate: (code: string) => boolean;
  expectedOutput?: string;
};

const PYTHON_BLOCK = /```(?:python|py)?\n([\s\S]*?)```/gi;

function extractPythonBlocks(text: string, max = 4): string[] {
  const blocks: string[] = [];
  for (const m of text.matchAll(PYTHON_BLOCK)) {
    const code = m[1]?.trim();
    if (code && code.length > 15) blocks.push(code);
    if (blocks.length >= max) break;
  }
  return blocks;
}

/**
 * Build practice exercises from uploaded notes — worked examples, code blocks, formulas.
 */
export function buildPracticeExercisesFromNotes(opts: {
  uploadedFiles: UploadedFile[];
  glossaryEntries: GlossaryEntry[];
  courses: Course[];
  courseId?: string;
  concept: string;
  lang: Lang;
}): CodeExercise[] {
  const { text, hasSource } = gatherAnalyzedText(opts.uploadedFiles, opts.courseId);
  if (!hasSource) return [];

  const linked =
    opts.courseId ??
    opts.uploadedFiles.find((f) => f.extractedText?.trim() && f.courseId)?.courseId;
  const glossary = linked
    ? opts.glossaryEntries.filter((g) => g.courseId === linked)
    : opts.glossaryEntries;

  const excerpt = relevantExcerpt(text, opts.concept, 16000);
  const exercises: CodeExercise[] = [];

  // Python blocks from notes → runnable exercises
  const codeBlocks = extractPythonBlocks(excerpt, 4);
  codeBlocks.forEach((block, i) => {
    const lines = block.split('\n');
    const incomplete = lines.some((l) => /#\s*TODO|pass\s*$|\.\.\./.test(l));
    const starter = incomplete
      ? block
      : `${block}\n\n# Extend or modify the code above to demonstrate «${opts.concept}»\nresult = None`;
    exercises.push({
      id: `py-note-${i}`,
      title: opts.lang === 'el' ? `Άσκηση κώδικα ${i + 1}` : `Code exercise ${i + 1}`,
      objective:
        opts.lang === 'el'
          ? `Εφάρμοσε κώδικα από τις σημειώσεις σου για «${opts.concept}».`
          : `Apply code from your notes for «${opts.concept}».`,
      starterCode: starter,
      hints: [
        opts.lang === 'el' ? 'Ξεκίνα από το snippet στις σημειώσεις σου.' : 'Start from the snippet in your notes.',
        opts.lang === 'el' ? 'Τρέξε τον κώδικα και έλεγξε το output.' : 'Run the code and verify the output.',
      ],
      solution: block,
      validate: (code) => code.trim().length > 20 && !/#\s*TODO/.test(code),
    });
  });

  // Worked examples → written / pseudo-code exercises
  for (const [i, example] of extractWorkedExamples(excerpt, opts.concept, 4).entries()) {
    exercises.push({
      id: `ex-note-${i}`,
      title:
        opts.lang === 'el'
          ? `Παράδειγμα: ${opts.concept.slice(0, 36)}`
          : `Worked example: ${opts.concept.slice(0, 36)}`,
      objective: example.slice(0, 160),
      starterCode:
        opts.lang === 'el'
          ? `# Από τις σημειώσεις σου:\n# ${example.slice(0, 90).replace(/\n/g, ' ')}\n\nanswer = """\n\n""" `
          : `# From your notes:\n# ${example.slice(0, 90).replace(/\n/g, ' ')}\n\nanswer = """\n\n"""`,
      hints: [example.slice(0, 100), ...(glossary.slice(0, 2).map((g) => `${g.term}: ${g.definition.slice(0, 60)}`))],
      solution: example,
      validate: (code) => {
        const body = code.replace(/^#.*$/gm, '').trim();
        return body.length > 25 && !body.includes('TODO');
      },
    });
  }

  // Formula application prompts
  for (const [i, f] of extractFormulas(excerpt, opts.concept, 2).entries()) {
    exercises.push({
      id: `formula-note-${i}`,
      title: opts.lang === 'el' ? `Τύπος: ${f.name}` : `Formula: ${f.name}`,
      objective:
        opts.lang === 'el'
          ? `Εφάρμοσε τον τύπο ${f.formula} με δεδομένα από τις σημειώσεις.`
          : `Apply ${f.formula} using values from your notes.`,
      starterCode: `# ${f.formula}\n# Substitute values from your notes\nresult = None`,
      hints: [f.formula, opts.lang === 'el' ? 'Καθόρισε τις μεταβλητές πρώτα.' : 'Identify variables first.'],
      solution: `# ${f.formula}\nresult = "computed from notes"`,
      validate: (code) => /result\s*=/.test(code) && code.trim().length > 15,
    });
  }

  if (exercises.length > 0) return exercises.slice(0, 6);

  // Single conceptual apply exercise from excerpt
  const summary = excerpt.slice(0, 200).replace(/\n/g, ' ');
  if (summary.length > 40) {
    exercises.push({
      id: 'concept-apply',
      title: opts.lang === 'el' ? `Εφαρμογή: ${opts.concept}` : `Apply: ${opts.concept}`,
      objective: summary,
      starterCode:
        opts.lang === 'el'
          ? `# Εξήγησε βήμα-βήμα με βάση τις σημειώσεις σου\nsteps = []\n`
          : `# Explain step-by-step from your notes\nsteps = []\n`,
      hints: [summary.slice(0, 120)],
      solution: summary,
      validate: (code) => code.trim().length > 30,
    });
  }

  return exercises;
}

export function getPracticeExercises(concept: string, fromNotes?: CodeExercise[]): CodeExercise[] {
  if (fromNotes && fromNotes.length > 0) return fromNotes;
  return genericExercises(concept);
}

function genericExercises(concept: string): CodeExercise[] {
  return [{
    id: 'gen-1',
    title: `Practice: ${concept}`,
    objective: `Apply ${concept} in a short exercise based on your uploaded material.`,
    starterCode: `# Implement a solution for ${concept}\nresult = None`,
    hints: [`Recall the definition of ${concept}`, 'Break the problem into steps from your notes'],
    solution: `# solution for ${concept}`,
    validate: (code) => code.trim().length > 20 && !code.includes('TODO'),
  }];
}
