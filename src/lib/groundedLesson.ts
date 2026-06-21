import type { Lang } from './i18n';
import type { LessonStepKey } from './domainContent';
import type { Topic } from '../types';
import {
  detectSections,
  extractiveSummary,
  splitSentences,
} from './contentAnalysis';
import { extractWorkedExamples, relevantExcerpt, conceptRelevanceScore } from './noteContentExtractors';

/** Pick the best section for a lesson step (section-aware, not paragraph rotation). */
function pickSection(
  sections: ReturnType<typeof detectSections>,
  preferredIndex: number,
  concept: string,
): (typeof sections)[number] | undefined {
  if (sections.length === 0) return undefined;
  const scored = sections.map((s, i) => ({
    s,
    score: conceptRelevanceScore((s.heading ?? '') + ' ' + s.text, concept) - Math.abs(i - preferredIndex) * 0.05,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.s;
}

/** Map canonical lesson step keys to note-grounded text (no demo templates). */
export function getNoteContentForLessonStep(
  key: LessonStepKey,
  text: string,
  concept: string,
  topic: Topic | undefined,
  lang: Lang,
): string {
  if (!text.trim()) return '';

  const excerpt = relevantExcerpt(text, concept, 14000);
  const sections = detectSections(excerpt);
  const paragraphs = excerpt.split(/\n{2,}/).filter((p) => p.trim());

  switch (key) {
    case 'intro': {
      const biasTerms = [concept, topic?.title, ...(topic?.keyConcepts?.slice(0, 3) ?? [])].filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      );
      const summary = extractiveSummary(excerpt, 2, { biasTerms, leadBias: 0.2, mmrLambda: 0.7 }).join('\n\n');
      const objectives = topic?.objectives?.length
        ? topic.objectives.map((o) => `• ${o}`).join('\n')
        : '';
      const heading = topic?.title ?? concept;
      const lead =
        lang === 'el'
          ? `Αυτό το μάθημα βασίζεται αποκλειστικά στο υλικό που ανέβασες για «${heading}».`
          : `This lesson is grounded exclusively in your uploaded material for «${heading}».`;
      const sectionLead = sections[0]?.heading
        ? (lang === 'el' ? `Ενότητα: ${sections[0].heading}` : `Section: ${sections[0].heading}`)
        : '';
      return [lead, sectionLead, summary, objectives].filter(Boolean).join('\n\n');
    }
    case 'explanation': {
      const sec = pickSection(sections, 0, concept);
      return sec?.text?.trim() || paragraphs[0]?.trim() || excerpt.slice(0, 900);
    }
    case 'example': {
      const ex = extractWorkedExamples(excerpt, concept, 1)[0];
      const exampleSection = pickSection(sections, 1, concept);
      return ex ?? exampleSection?.text?.trim() ?? paragraphs[1]?.trim() ?? '';
    }
    case 'misconception': {
      const caution = splitSentences(excerpt).find((s) =>
        /\b(common mistake|misconception|confus|λάθος|παρερμην|συχνό λάθος|προσοχή|προσέξτε)/i.test(s),
      );
      const contrastSection = sections.find((s) =>
        /\b(vs|versus|unlike|whereas|αντίθετα|διαφορά|compare)/i.test((s.heading ?? '') + s.text),
      );
      return (
        caution ??
        contrastSection?.text?.trim().slice(0, 500) ??
        (lang === 'el'
          ? 'Σύγκρινε προσεκτικά τους ορισμούς στις σημειώσεις σου — αποφύγετε εννοιολογικές συγχύσεις.'
          : 'Compare definitions in your notes carefully — avoid conflating related concepts.')
      );
    }
    case 'practice': {
      const ex = extractWorkedExamples(excerpt, concept, 1)[0];
      if (ex) return ex;
      const practiceSection = pickSection(sections, Math.max(0, sections.length - 2), concept);
      return (
        practiceSection?.text?.trim().slice(0, 600) ??
        (lang === 'el'
          ? `Εξάσκηση: Εφάρμοσε την έννοια «${concept}» σε μια πρόταση από τις σημειώσεις σου.`
          : `Practice: Apply «${concept}» using a sentence pattern from your notes.`)
      );
    }
    case 'summary': {
      const lastSection = sections[sections.length - 1];
      const biasTerms = [concept, topic?.title, ...(topic?.keyConcepts?.slice(0, 3) ?? [])].filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
      );
      const summary = extractiveSummary(lastSection?.text ?? excerpt, 3, { biasTerms, mmrLambda: 0.6 }).join('\n\n');
      return summary || excerpt.slice(0, 600);
    }
    case 'quiz':
    default:
      return '';
  }
}
