import type { Lang } from './i18n';

export type LandingFeature = { title: string; desc: string };
export type LandingUserType = { label: string; desc: string };
export type LandingStep = { num: string; title: string; desc: string };
export type DiffItem = { wrong: string; right: string };

export type LandingContent = {
  badge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  trust: string[];
  features: LandingFeature[];
  userTypes: LandingUserType[];
  steps: LandingStep[];
  getStarted: string;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  featuresSectionTitle: string;
  featuresSectionSubtitle: string;
  diffTitle: string;
  diffSubtitle: string;
  diffItems: DiffItem[];
  testimonialQuote: string;
  testimonialAuthor: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
  footerTagline: string;
};

const LANDING: Record<Lang, LandingContent> = {
  en: {
    badge: 'AI-Powered Adaptive Learning Platform',
    heroTitle: 'From Static Notes to',
    heroHighlight: 'Adaptive Tutoring',
    heroSubtitle:
      'Upload your notes, PDFs, or slides. The AI builds a personalized interactive tutor-course — then discovers how you actually learn through your behavior, errors, and progress.',
    ctaPrimary: 'Start Learning Now',
    ctaSecondary: 'See Demo',
    getStarted: 'Get Started',
    trust: ['No credit card required', 'Works with any subject', 'Source-grounded AI'],
    features: [
      { title: 'Upload Anything', desc: 'PDFs, slides, notes, images, code files, lecture transcripts — the AI handles it all.' },
      { title: 'AI Course Generation', desc: 'Automatically extracts topics, concepts, prerequisites, and builds a structured learning path.' },
      { title: 'Adaptive Tutoring', desc: 'The system learns how you learn — adjusting pace, depth, and practice based on real behavior.' },
      { title: 'Interactive Practice', desc: 'Quizzes, coding challenges, Socratic dialogues, exam simulations, and problem-solving loops.' },
      { title: 'Spaced Repetition', desc: 'Scientifically-timed reviews based on your forgetting curve and retention predictions.' },
      { title: 'Learning Analytics', desc: 'See mastery maps, weak spots, error patterns, misconceptions, and predicted retention.' },
    ],
    userTypes: [
      { label: 'University Students', desc: 'Turn lecture notes into exam-ready courses' },
      { label: 'High School Students', desc: 'Structured tutoring and exam preparation' },
      { label: 'Self-Learners', desc: 'Learn anything from your own materials' },
      { label: 'Tutors & Teachers', desc: 'Generate interactive lessons instantly' },
      { label: 'Companies', desc: 'Transform manuals into training modules' },
    ],
    steps: [
      { num: '01', title: 'Upload Your Material', desc: 'Drop your notes, PDFs, slides, or paste any content.' },
      { num: '02', title: 'AI Analyzes & Structures', desc: 'Topics, concepts, prerequisites, gaps — all extracted automatically.' },
      { num: '03', title: 'Learn Interactively', desc: 'Step-by-step lessons, practice, quizzes, and Socratic tutoring.' },
      { num: '04', title: 'Adapt & Master', desc: 'The platform discovers how you learn and optimizes your path.' },
    ],
    howItWorksTitle: 'How It Works',
    howItWorksSubtitle: 'Four simple steps from raw material to mastery',
    featuresSectionTitle: 'Everything You Need to Master Any Subject',
    featuresSectionSubtitle: 'Powered by cognitive science, not gimmicks',
    diffTitle: 'Not Just Another AI Chat',
    diffSubtitle: "Synapse doesn't guess how you learn. It discovers it through your behavior.",
    diffItems: [
      { wrong: '❌ Fixed "learning styles" (visual/auditory)', right: '✅ Evidence-based adaptive model from real behavior' },
      { wrong: '❌ Generic AI chat with no structure', right: '✅ Full interactive course with mastery tracking' },
      { wrong: '❌ Flashcards only or summaries only', right: '✅ Lessons, quizzes, practice, Socratic tutoring, exam prep' },
      { wrong: '❌ Hallucinated content without sources', right: '✅ Source-grounded with citation verification' },
      { wrong: '❌ One-size-fits-all pacing', right: '✅ Adapts difficulty, depth, and pace to your errors' },
      { wrong: '❌ Passive reading without recall', right: '✅ Anti-passive learning with active recall prompts' },
    ],
    testimonialQuote:
      "I uploaded my semester's notes and Synapse turned them into an interactive course that actually taught me better than re-reading ever could.",
    testimonialAuthor: 'Student · note-grounded learning',
    ctaTitle: 'Ready to Transform How You Learn?',
    ctaSubtitle: 'Upload your first document and experience AI-powered adaptive tutoring in minutes.',
    ctaButton: 'Get Started Free',
    footerTagline: '© 2026 Synapse Learning. From static notes to adaptive tutoring.',
  },
  el: {
    badge: 'Πλατφόρμα Προσαρμοστικής Μάθησης με AI',
    heroTitle: 'Από στατικές σημειώσεις σε',
    heroHighlight: 'Προσαρμοστική Διδασκαλία',
    heroSubtitle:
      'Ανέβασε σημειώσεις, PDF ή διαφάνειες. Το AI δημιουργεί εξατομικευμένο διαδραστικό μάθημα — και μαθαίνει πώς μαθαίνεις εσύ από τη συμπεριφορά, τα λάθη και την πρόοδό σου.',
    ctaPrimary: 'Ξεκίνα Τώρα',
    ctaSecondary: 'Δες Demo',
    getStarted: 'Ξεκίνα',
    trust: ['Χωρίς πιστωτική κάρτα', 'Για κάθε αντικείμενο', 'AI με βάση τις πηγές σου'],
    features: [
      { title: 'Ανέβασμα Οτιδήποτε', desc: 'PDF, slides, σημειώσεις, εικόνες, κώδικας, transcripts.' },
      { title: 'Δημιουργία Μαθήματος', desc: 'Εξαγωγή θεμάτων, εννοιών, προαπαιτούμενων και δομημένης διαδρομής.' },
      { title: 'Προσαρμοστική Διδασκαλία', desc: 'Προσαρμογή ρυθμού, βάθους και εξάσκησης από τη συμπεριφορά σου.' },
      { title: 'Διαδραστική Εξάσκηση', desc: 'Κουίζ, coding, Socratic διάλογος, προσομοίωση εξετάσεων.' },
      { title: 'Spaced Repetition', desc: 'Επιστημονικά χρονομετρημένες επαναλήψεις.' },
      { title: 'Αναλυτικά Μάθησης', desc: 'Mastery maps, αδύναμα σημεία, λάθη και retention.' },
    ],
    userTypes: [
      { label: 'Φοιτητές', desc: 'Μετέτρεψε σημειώσεις σε ετοιμότητα εξετάσεων' },
      { label: 'Μαθητές Λυκείου', desc: 'Δομημένη διδασκαλία' },
      { label: 'Αυτοδίδακτοι', desc: 'Μάθε από δικό σου υλικό' },
      { label: 'Καθηγητές', desc: 'Διαδραστικά μαθήματα άμεσα' },
      { label: 'Εταιρείες', desc: 'Εκπαιδευτικά modules από εγχειρίδια' },
    ],
    steps: [
      { num: '01', title: 'Ανέβασε Υλικό', desc: 'Σημειώσεις, PDF, slides ή επικόλληση.' },
      { num: '02', title: 'AI Ανάλυση', desc: 'Θέματα, έννοιες, προαπαιτούμενα — αυτόματα.' },
      { num: '03', title: 'Μάθε Διαδραστικά', desc: 'Μαθήματα, εξάσκηση, κουίζ, Socratic tutoring.' },
      { num: '04', title: 'Προσαρμογή', desc: 'Βελτιστοποίηση διαδρομής μάθησης.' },
    ],
    howItWorksTitle: 'Πώς Λειτουργεί',
    howItWorksSubtitle: 'Τέσσερα βήματα από το υλικό σου στην κατάκτηση',
    featuresSectionTitle: 'Ό,τι Χρειάζεσαι',
    featuresSectionSubtitle: 'Γνωστική επιστήμη, όχι gimmicks',
    diffTitle: 'Όχι Ακόμα ένα AI Chat',
    diffSubtitle: 'Το Synapse ανακαλύπτει πώς μαθαίνεις από τη συμπεριφορά σου.',
    diffItems: [
      { wrong: '❌ Σταθερά learning styles', right: '✅ Προσαρμοστικό μοντέλο από συμπεριφορά' },
      { wrong: '❌ Γενικό chat', right: '✅ Πλήρες μάθημα με mastery tracking' },
      { wrong: '❌ Μόνο flashcards', right: '✅ Μαθήματα, κουίζ, exam prep' },
      { wrong: '❌ Hallucinations', right: '✅ Source-grounded citations' },
      { wrong: '❌ Ίδιος ρυθμός', right: '✅ Προσαρμογή δυσκολίας' },
      { wrong: '❌ Παθητική ανάγνωση', right: '✅ Active recall' },
    ],
    testimonialQuote: 'Ανέβασα τις σημειώσεις μου και έγιναν διαδραστικό μάθημα από το δικό μου υλικό.',
    testimonialAuthor: 'Φοιτητής · note-grounded learning',
    ctaTitle: 'Έτοιμος να Αλλάξεις τον Τρόπο που Μαθαίνεις;',
    ctaSubtitle: 'Ανέβασε το πρώτο σου έγγραφο σε λίγα λεπτά.',
    ctaButton: 'Ξεκίνα Δωρεάν',
    footerTagline: '© 2026 Synapse Learning.',
  },
};

export function getLandingContent(lang: Lang): LandingContent {
  return LANDING[lang];
}
