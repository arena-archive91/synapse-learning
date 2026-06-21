/**
 * Demo-only domain content (Cournot, elasticity, pandas showcase).
 * Loaded only when Settings → Demo showcase is ON.
 */
import type { Lang } from '../lib/i18n';
import type { QuizDef, WorkspaceStep } from '../lib/lessonTypes';

const QUIZ_MARKET: Record<Lang, QuizDef> = {
  en: {
    question: 'In Bertrand competition with identical products, the equilibrium price is:',
    options: ['Above marginal cost', 'Equal to marginal cost', 'Equal to average total cost', 'Zero'],
    correctIndex: 1,
  },
  el: {
    question: 'Στον ανταγωνισμό Bertrand με ίδια προϊόντα, η τιμή ισορροπίας είναι:',
    options: ['Πάνω από το οριακό κόστος', 'Ίση με το οριακό κόστος', 'Ίση με το μέσο συνολικό κόστος', 'Μηδέν'],
    correctIndex: 1,
  },
};

const QUIZ_ELASTIC: Record<Lang, QuizDef> = {
  en: {
    question: 'Price elasticity of demand measures:',
    options: [
      'Absolute change in price',
      'Percentage change in quantity / percentage change in price',
      'Total revenue only',
      'Consumer surplus',
    ],
    correctIndex: 1,
  },
  el: {
    question: 'Η ελαστικότητα ζήτησης ως προς την τιμή μετρά:',
    options: [
      'Απόλυτη μεταβολή τιμής',
      '% μεταβολή ποσότητας / % μεταβολή τιμής',
      'Μόνο συνολικά έσοδα',
      'Πλεόνασμα καταναλωτή',
    ],
    correctIndex: 1,
  },
};

const QUIZ_PANDAS: Record<Lang, QuizDef> = {
  en: {
    question: 'Which pandas method groups rows and applies aggregation?',
    options: ['merge()', 'groupby()', 'pivot()', 'concat()'],
    correctIndex: 1,
  },
  el: {
    question: 'Ποια μέθοδος pandas ομαδοποιεί γραμμές και εφαρμόζει aggregation;',
    options: ['merge()', 'groupby()', 'pivot()', 'concat()'],
    correctIndex: 1,
  },
};

function conceptDomain(concept: string): 'market' | 'elastic' | 'pandas' | 'generic' {
  const c = concept.toLowerCase();
  if (c.includes('bertrand') || c.includes('cournot') || c.includes('oligopoly') || c.includes('market')) {
    return 'market';
  }
  if (c.includes('elastic')) return 'elastic';
  if (c.includes('pandas') || c.includes('groupby')) return 'pandas';
  return 'generic';
}

export function demoQuizForConcept(concept: string, lang: Lang): QuizDef {
  const domain = conceptDomain(concept);
  if (domain === 'market') return QUIZ_MARKET[lang];
  if (domain === 'elastic') return QUIZ_ELASTIC[lang];
  if (domain === 'pandas') return QUIZ_PANDAS[lang];
  return {
    question: lang === 'el' ? `Ποια πρόταση περιγράφει καλύτερα το «${concept}»;` : `Which statement best describes ${concept}?`,
    options: lang === 'el'
      ? ['Ο βασικός ορισμός από το demo υλικό', 'Άσχετη έννοια', 'Το αντίθετο', 'Edge case μόνο']
      : ['Core definition from demo material', 'Unrelated concept', 'The opposite', 'Edge case only'],
    correctIndex: 0,
  };
}

export function demoWorkspaceStepsForConcept(concept: string, lang: Lang): WorkspaceStep[] {
  const domain = conceptDomain(concept);
  const quizStep = lang === 'el'
    ? { title: 'Έλεγχος Γνώσεων', type: 'Κουίζ' }
    : { title: 'Knowledge Check', type: 'Quiz' };

  if (domain === 'market') {
    return lang === 'el'
      ? [
          { title: `Δύο μοντέλα ${concept}`, type: 'Βασική Έννοια' },
          { title: 'Cournot: Ανταγωνισμός Ποσότητας', type: 'Εμβάθυνση' },
          { title: 'Bertrand: Ανταγωνισμός Τιμής', type: 'Εμβάθυνση' },
          { title: 'Το Παράδοξο Bertrand', type: 'Βασική Ιδέα' },
          { title: 'Εργαζόμενο Παράδειγμα', type: 'Εξάσκηση' },
          quizStep,
        ]
      : [
          { title: `Two Models of ${concept}`, type: 'Core Concept' },
          { title: 'Cournot: Quantity Competition', type: 'Deep Dive' },
          { title: 'Bertrand: Price Competition', type: 'Deep Dive' },
          { title: 'The Bertrand Paradox', type: 'Key Insight' },
          { title: 'Worked Example', type: 'Practice' },
          quizStep,
        ];
  }

  if (domain === 'elastic') {
    return lang === 'el'
      ? [
          { title: `Ορισμός: ${concept}`, type: 'Βασική Έννοια' },
          { title: 'Τύπος & Σημάδια', type: 'Εμβάθυνση' },
          { title: 'Έσοδα & Ελαστικότητα', type: 'Εμβάθυνση' },
          quizStep,
        ]
      : [
          { title: `Definition: ${concept}`, type: 'Core Concept' },
          { title: 'Formula & Signs', type: 'Deep Dive' },
          { title: 'Revenue & Elasticity', type: 'Deep Dive' },
          quizStep,
        ];
  }

  return lang === 'el'
    ? [{ title: concept, type: 'Βασική Έννοια' }, { title: 'Demo βήμα', type: 'Εμβάθυνση' }, quizStep]
    : [{ title: concept, type: 'Core Concept' }, { title: 'Demo step', type: 'Deep Dive' }, quizStep];
}

export function demoPracticeAnswer(concept: string): number {
  const c = concept.toLowerCase();
  if (c.includes('bertrand') || c.includes('cournot') || c.includes('oligopoly')) return 10;
  if (c.includes('elastic')) return -1.5;
  return 10;
}
