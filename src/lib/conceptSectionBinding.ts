/**
 * Binds extracted concepts to the document section where they are most salient.
 * Prevents keyphrase bleed: a concept mined in section A is not assigned to topic B
 * when its supporting evidence lives elsewhere.
 */

import { normalizeConcept, type Section } from './contentAnalysis';
import { tokenize } from './rag';

/** Salience of a concept phrase inside a text block (0–1). */
export function conceptSalience(concept: string, text: string): number {
  const lower = text.toLowerCase();
  const phrase = concept.toLowerCase().trim();
  if (!phrase || !lower) return 0;

  const phraseHit = phrase.length > 4 && lower.includes(phrase) ? 0.45 : 0;
  const words = phrase.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return phraseHit;

  const textTokens = new Set(tokenize(text));
  let hits = 0;
  for (const w of words) {
    if (textTokens.has(w) || lower.includes(w)) hits += 1;
  }
  const overlap = hits / words.length;
  return Math.min(1, overlap * 0.55 + phraseHit);
}

/** Index of the section with highest salience for this concept (-1 if none). */
export function bestSectionIndex(concept: string, sections: Section[]): number {
  let best = -1;
  let bestScore = 0;
  sections.forEach((s, i) => {
    const body = `${s.heading ?? ''}\n${s.text}`;
    const score = conceptSalience(concept, body);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 0.22 ? best : -1;
}

/**
 * Keep concepts whose strongest evidence is in `sectionIndex`.
 * Allows shared concepts only when salience is within 15% of the best section.
 */
export function filterConceptsForSection(
  concepts: string[],
  sectionIndex: number,
  sections: Section[],
): string[] {
  if (sections.length <= 1) return concepts;

  return concepts.filter((concept) => {
    const norm = normalizeConcept(concept);
    if (!norm) return false;

    let bestIdx = -1;
    let bestScore = 0;
    sections.forEach((s, i) => {
      const body = `${s.heading ?? ''}\n${s.text}`;
      const score = conceptSalience(concept, body);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });

    if (bestIdx < 0 || bestScore < 0.18) return sectionIndex === 0;
    if (bestIdx === sectionIndex) return true;

    const here = conceptSalience(concept, `${sections[sectionIndex]?.heading ?? ''}\n${sections[sectionIndex]?.text ?? ''}`);
    return here >= bestScore * 0.85;
  });
}
