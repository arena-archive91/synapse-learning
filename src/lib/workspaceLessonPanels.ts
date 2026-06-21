import type { Lang } from './i18n';

export type WorkspacePanelBlock =
  | { kind: 'paragraph'; text: string; emphasis?: string }
  | { kind: 'cards'; items: { title: string; bullets: string[]; accent?: 'brand' | 'teal' | 'amber' }[] }
  | { kind: 'formula'; label: string; formula: string }
  | { kind: 'callout'; title: string; text: string; variant: 'warning' | 'tip' }
  | { kind: 'steps'; items: { label: string; content: string; success?: boolean }[] }
  | { kind: 'actions'; items: { label: string }[] }
  | { kind: 'source'; text: string };

export type WorkspacePanel = {
  badge: string;
  title: string;
  blocks: WorkspacePanelBlock[];
};

function genericPanels(concept: string, lang: Lang): WorkspacePanel[] {
  const isEl = lang === 'el';
  return [
    {
      badge: isEl ? 'Βασική Έννοια' : 'Core Concept',
      title: concept,
      blocks: [
        {
          kind: 'paragraph',
          text: isEl
            ? `Η έννοια «${concept}» είναι κεντρική για αυτή τη συνεδρία. Ξεκίνα με τον βασικό ορισμό από το υλικό σου.`
            : `${concept} is central to this session. Start with the core definition from your material.`,
        },
        { kind: 'callout', title: isEl ? '💡 Υπόδειξη' : '💡 Tip', text: isEl ? 'Χρησιμοποίησε τον Feynman Check.' : 'Use the Feynman Check to verify understanding.', variant: 'tip' },
      ],
    },
    {
      badge: isEl ? 'Εμβάθυνση' : 'Deep Dive',
      title: isEl ? 'Μηχανισμός' : 'Mechanism',
      blocks: [
        { kind: 'paragraph', text: isEl ? 'Ποιες μεταβλητές συνδέονται;' : 'What variables connect in your notes?' },
      ],
    },
    {
      badge: isEl ? 'Εξάσκηση' : 'Practice',
      title: isEl ? 'Εργασία' : 'Worked Task',
      blocks: [
        { kind: 'paragraph', text: isEl ? 'Εφάρμοσε την έννοια από τις σημειώσεις σου.' : 'Apply the concept using your uploaded notes.' },
      ],
    },
  ];
}

/** Production fallback panels — note-grounded LLM panels take priority when available. */
export function getWorkspaceLessonPanel(step: number, concept: string, lang: Lang): WorkspacePanel | null {
  const panels = genericPanels(concept, lang);
  return panels[step] ?? panels[0] ?? null;
}

export function feynmanOutlineForConcept(concept: string, lang: Lang): string[] {
  if (lang === 'el') {
    return [
      `Ποια είναι η βασική ιδέα του «${concept}»;`,
      'Γιατί έχει σημασία;',
      'Ποια είναι μια συνηθισμένη παρανόηση;',
      'Δώσε ένα παράδειγμα από τις σημειώσεις σου.',
    ];
  }
  return [
    `What is the core idea of ${concept}?`,
    'Why does it matter?',
    'What is a common misconception?',
    'Give one example from your notes.',
  ];
}

export function feynmanPlaceholderForConcept(concept: string, lang: Lang): string {
  if (lang === 'el') {
    return `Εξήγησε την έννοια «${concept}» με δικά σου λόγια, βασιζόμενος/η στις σημειώσεις σου…`;
  }
  return `Explain ${concept} in your own words, using your uploaded notes…`;
}
