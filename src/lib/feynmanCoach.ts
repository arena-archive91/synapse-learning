import type { RubricScores, RubricDimension } from './feynmanRubric';
import type { UserSettings } from '../types';
import { extractiveSummary } from './contentAnalysis';
import { agentTonePrefix } from './settingsEffects';

function dimensionTips(concept: string, lang: 'en' | 'el'): Record<RubricDimension, string> {
  const t = (en: string, el: string) => (lang === 'el' ? el : en);
  return {
    accuracy: t(
      `Use precise terms from your notes about «${concept}». Name definitions explicitly and avoid mixing related concepts.`,
      `Χρησιμοποίησε ακριβείς όρους από τις σημειώσεις σου για «${concept}». Ονόμασε ρητά τους ορισμούς.`,
    ),
    completeness: t(
      `Cover the core mechanism of «${concept}»: what it is, why it matters, and one concrete example from your material.`,
      `Κάλυψε τον μηχανισμό του «${concept}»: τι είναι, γιατί έχει σημασία και ένα συγκεκριμένο παράδειγμα από το υλικό σου.`,
    ),
    simplicity: t(
      'Shorten sentences. One idea per sentence. Replace jargon with plain words, then define any term you must keep.',
      'Κόψε τις προτάσεις. Μία ιδέα ανά πρόταση. Αντικατάστησε jargon με απλά λόγια και όρισε κάθε όρο που κρατάς.',
    ),
    structure: t(
      `Use a clear arc: core idea → why it matters → key details of «${concept}» → one example → one-line takeaway.`,
      `Χρησιμοποίησε δομή: βασική ιδέα → γιατί έχει σημασία → λεπτομέρειες του «${concept}» → παράδειγμα → σύνοψη.`,
    ),
  };
}

export type CoachFeedback = {
  headline: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  rewrite?: string;
  nextStep: string;
};

export function generateFeynmanCoachFeedback(
  userDraft: string,
  scores: RubricScores,
  weakDims: RubricDimension[],
  concept: string,
  settings?: UserSettings,
  referenceNotes?: string,
): CoachFeedback {
  const lang = settings?.language ?? 'en';
  const tone = settings ? agentTonePrefix(settings) : '';
  const tips = dimensionTips(concept, lang);
  const avg = Math.round(
    (scores.accuracy + scores.completeness + scores.simplicity + scores.structure) / 4,
  );

  const strengths: string[] = [];
  const improvements: string[] = [];

  (Object.keys(scores) as RubricDimension[]).forEach((dim) => {
    const label = dim.charAt(0).toUpperCase() + dim.slice(1);
    if (scores[dim] >= 75) {
      strengths.push(
        lang === 'el'
          ? `${label}: ${scores[dim]}% — καλή κάλυψη.`
          : `${label}: ${scores[dim]}% — solid coverage.`,
      );
    }
  });

  weakDims.forEach((dim) => {
    improvements.push(tips[dim]);
  });

  if (improvements.length === 0) {
    improvements.push(
      lang === 'el'
        ? 'Δοκίμασε να εξηγήσεις την ίδια ιδέα σε 3 προτάσεις χωρίς jargon — έλεγχος κατανόησης.'
        : 'Try explaining the same idea in 3 sentences with zero jargon — retention check.',
    );
  }

  const headline =
    lang === 'el'
      ? `${tone}Αξιολόγηση Feynman για «${concept}» — ${avg}%`
      : `${tone}Feynman review for "${concept}" — ${avg}%`;

  const nextStep =
    avg >= 80
      ? lang === 'el'
        ? 'Επόμενο βήμα: κάνε spaced review σε 24 ώρες ή δοκίμασε το Knowledge Check.'
        : 'Next: schedule a spaced review in 24h or take the Knowledge Check.'
      : lang === 'el'
        ? `Επόμενο βήμα: ξαναγράψε ακολουθώντας το outline και συμπεριέλαβε τους βασικούς όρους για «${concept}».`
        : `Next: rewrite using the outline and include the key terms for «${concept}» from your notes.`;

  const noteRewrite =
    (referenceNotes?.trim().length ?? 0) > 80
      ? extractiveSummary(referenceNotes!, 2, { biasTerms: [concept] }).join('\n\n')
      : userDraft.trim().length > 80
        ? extractiveSummary(userDraft, 2, { biasTerms: [concept] }).join('\n\n')
        : '';

  return {
    headline,
    overallScore: avg,
    strengths: strengths.length > 0 ? strengths : [lang === 'el' ? 'Καλή αρχή — συνέχισε να επεκτείνεις.' : 'Good start — keep expanding the mechanism.'],
    improvements,
    rewrite:
      avg < 78 && noteRewrite
        ? (lang === 'el' ? '**Προτεινόμενη επαναδιατύπωση (από τις σημειώσεις):**\n\n' : '**Suggested rewrite (from your notes):**\n\n') +
          noteRewrite
        : undefined,
    nextStep,
  };
}
