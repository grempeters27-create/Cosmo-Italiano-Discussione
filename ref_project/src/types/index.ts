export type LessonPhase = 1 | 2 | 3 | 4;

export type VoiceGender = 'maschile' | 'femminile';

export interface VoiceConfig {
  gender: VoiceGender;
  voiceName: 'Puck' | 'Kore';
  displayName: string;
}

export interface FeedbackItem {
  original: string;
  correction: string;
  explanation: string;
  category?: string;
}

export interface ExerciseItem {
  id: string;
  type?: 'fill-blank' | 'translation' | 'rewrite' | string;
  question: string;
  hint?: string;
  expectedAnswer: string;
  userAnswer?: string;
  isCorrect?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  phase: LessonPhase;
  audioUrl?: string;
  feedbackItems?: FeedbackItem[];
  exercises?: ExerciseItem[];
  culturalTip?: string;
  suggestedReplies?: string[];
  isAudioPlaying?: boolean;
}

export type TopicCategoryId = 'cultura' | 'geografia' | 'notizie' | 'giochi' | 'grammatica';

export interface TopicCategory {
  id: TopicCategoryId;
  title: string;
  titleIt?: string;
  titleDe?: string;
  description: string;
  descriptionIt?: string;
  descriptionDe?: string;
  icon: string;
  badgeColor: string;
}

export interface DailyTopic {
  id: string;
  categoryId?: TopicCategoryId;
  title: string;
  category: string;
  categoryDe?: string;
  description: string;
  starterPrompt: string;
  italianHeadline: string;
  gameType?: string;
  grammarFocus?: string;
  gameRules?: string;
  isNewsResearched?: boolean;
}

export interface NotebookEntry {
  id: string;
  date: string;
  phrase: string;
  naturalForm: string;
  explanation: string;
  category: string;
  topic?: string;
}

export interface CallFeedbackError {
  original: string;
  correction: string;
  explanation: string;
}

export interface CallFeedbackVocab {
  phrase: string;
  meaning: string;
}

export interface CallFeedbackData {
  praise: string;
  hasMajorErrors: boolean;
  errors: CallFeedbackError[];
  vocabularyAndPhrases: CallFeedbackVocab[];
  grammarTip: string;
  estimatedProficiencyScore?: number;
}

export type ProficiencyStage =
  | 'calibrazione'
  | 'principiante'
  | 'elementare'
  | 'intermedio'
  | 'avanzato'
  | 'fluente';

export interface UserProficiency {
  score: number | null; // 0 - 100, null if in initial calibration
  stage: ProficiencyStage;
  stageLabel: string; // "In calibrazione", "Principiante", "Elementare", "Intermedio", "Avanzato", "Fluente"
  speechPaceLabel?: string; // "Ritmo lento & scandito", "Ritmo calmo", "Ritmo naturale", etc.
  lastFeedbackChoice?: 'difficile' | 'perfetto' | 'facile';
  totalAssessments: number;
  updatedAt: number;
}

export type PersonalFactCategory =
  | 'name'
  | 'location'
  | 'profession'
  | 'interests'
  | 'learning_goals'
  | 'family_or_pets'
  | 'other';

export interface UserPersonalFact {
  id: string;
  category: PersonalFactCategory;
  label: string; // e.g., "Nome", "Città", "Lavoro", "Hobby", "Famiglia"
  value: string; // e.g., "Marco", "Monaco di Baviera", "Ingegnere", "Chitarra"
  updatedAt: number;
}

export interface UserProfile {
  name: string;
  proficiency?: UserProficiency;
  facts: UserPersonalFact[];
  customNotes?: string;
  updatedAt: number;
}

export interface SessionHistoryItem {
  id: string;
  timestamp: number;
  dateFormatted: string;
  topic: string;
  durationSeconds: number;
  summary: string; // Concise 1-2 sentence pedagogical summary of what was discussed
  keyPoints: string[]; // 2-3 brief bullet highlights
  newPersonalFacts?: Array<{ label: string; value: string }>;
  difficultyFeedback?: 'difficile' | 'perfetto' | 'facile';
}

export interface TutorMemory {
  userProfile: UserProfile;
  sessionHistory: SessionHistoryItem[]; // FIFO queue, limited to maxSessions
  maxSessions: number; // default: 8
}

