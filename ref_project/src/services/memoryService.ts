import { TutorMemory, UserProfile, SessionHistoryItem, UserPersonalFact, PersonalFactCategory, UserProficiency, ProficiencyStage } from '../types';

const STORAGE_MEMORY_KEY = 'maestro_italiano_memory_v1';
export const DEFAULT_MAX_SESSIONS = 8;

export const INITIAL_PROFICIENCY: UserProficiency = {
  score: null, // Open calibration!
  stage: 'calibrazione',
  stageLabel: 'In calibrazione',
  totalAssessments: 0,
  updatedAt: Date.now(),
};

const INITIAL_MEMORY: TutorMemory = {
  userProfile: {
    name: '',
    proficiency: INITIAL_PROFICIENCY,
    facts: [],
    customNotes: '',
    updatedAt: Date.now(),
  },
  sessionHistory: [],
  maxSessions: DEFAULT_MAX_SESSIONS,
};

/**
 * Determine proficiency stage, Italian label and spoken pacing label from a numeric score (0-100)
 */
export function getProficiencyStage(score: number | null): { stage: ProficiencyStage; stageLabel: string; speechPaceLabel: string } {
  if (score === null || score === undefined || isNaN(score)) {
    return { stage: 'calibrazione', stageLabel: 'In calibrazione', speechPaceLabel: 'Ritmo adattivo' };
  }
  if (score <= 25) return { stage: 'principiante', stageLabel: 'Principiante', speechPaceLabel: 'Lento & Scandito' };
  if (score <= 35) return { stage: 'elementare', stageLabel: 'Base / Elementare', speechPaceLabel: 'Lento & Scandito' };
  if (score <= 45) return { stage: 'elementare', stageLabel: 'Elementare', speechPaceLabel: 'Calmo & Chiaro' };
  if (score <= 65) return { stage: 'intermedio', stageLabel: 'Intermedio', speechPaceLabel: 'Rilassato & Naturale' };
  if (score <= 85) return { stage: 'avanzato', stageLabel: 'Avanzato', speechPaceLabel: 'Fluente Madrelingua' };
  return { stage: 'fluente', stageLabel: 'Fluente', speechPaceLabel: 'Madrelingua Spontaneo' };
}

/**
 * Retrieve the current memory state from localStorage.
 * Ensures synchronization between userProfile.name, facts array, and proficiency.
 */
export function getStoredMemory(): TutorMemory {
  try {
    const raw = localStorage.getItem(STORAGE_MEMORY_KEY);
    if (!raw) return INITIAL_MEMORY;
    const parsed = JSON.parse(raw);
    const name = (parsed.userProfile?.name || '').trim();
    let facts: UserPersonalFact[] = Array.isArray(parsed.userProfile?.facts)
      ? parsed.userProfile.facts
      : [];

    // Parse proficiency or initialize open calibration
    let proficiency: UserProficiency = INITIAL_PROFICIENCY;
    if (parsed.userProfile?.proficiency) {
      const p = parsed.userProfile.proficiency;
      const score = typeof p.score === 'number' && !isNaN(p.score) ? p.score : null;
      const { stage, stageLabel, speechPaceLabel } = getProficiencyStage(score);
      proficiency = {
        score,
        stage,
        stageLabel: p.stageLabel || stageLabel,
        speechPaceLabel: p.speechPaceLabel || speechPaceLabel,
        lastFeedbackChoice: p.lastFeedbackChoice,
        totalAssessments: typeof p.totalAssessments === 'number' ? p.totalAssessments : 0,
        updatedAt: p.updatedAt || Date.now(),
      };
    }

    // If a name is stored in userProfile.name, make sure it is also reflected in facts
    if (name) {
      const hasNameFact = facts.some(
        (f) => f.category === 'name' || f.label.toLowerCase() === 'nome' || f.label.toLowerCase() === 'name'
      );
      if (!hasNameFact) {
        facts = [
          {
            id: `fact-name-${Date.now()}`,
            category: 'name',
            label: 'Nome',
            value: name,
            updatedAt: Date.now(),
          },
          ...facts,
        ];
      }
    }

    return {
      userProfile: {
        name,
        proficiency,
        facts,
        customNotes: parsed.userProfile?.customNotes || '',
        updatedAt: parsed.userProfile?.updatedAt || Date.now(),
      },
      sessionHistory: Array.isArray(parsed.sessionHistory) ? parsed.sessionHistory : [],
      maxSessions: typeof parsed.maxSessions === 'number' ? parsed.maxSessions : DEFAULT_MAX_SESSIONS,
    };
  } catch (err) {
    console.warn('Could not read memory from localStorage, returning default:', err);
    return INITIAL_MEMORY;
  }
}

/**
 * Persist the memory state to localStorage.
 */
export function saveStoredMemory(memory: TutorMemory): void {
  try {
    localStorage.setItem(STORAGE_MEMORY_KEY, JSON.stringify(memory));
  } catch (err) {
    console.warn('Could not save memory to localStorage:', err);
  }
}

/**
 * Update user profile name and/or custom permanent notes.
 * Automatically synchronizes with the permanent facts list.
 */
export function updateUserProfile(updates: { name?: string; customNotes?: string }): TutorMemory {
  const memory = getStoredMemory();
  if (updates.name !== undefined) {
    const cleanName = updates.name.trim();
    memory.userProfile.name = cleanName;

    // Synchronize or create "Nome" fact
    const nameFactIdx = memory.userProfile.facts.findIndex(
      (f) => f.category === 'name' || f.label.toLowerCase() === 'nome' || f.label.toLowerCase() === 'name'
    );
    if (cleanName) {
      if (nameFactIdx !== -1) {
        memory.userProfile.facts[nameFactIdx].value = cleanName;
        memory.userProfile.facts[nameFactIdx].updatedAt = Date.now();
      } else {
        memory.userProfile.facts.unshift({
          id: `fact-name-${Date.now()}`,
          category: 'name',
          label: 'Nome',
          value: cleanName,
          updatedAt: Date.now(),
        });
      }
    } else if (nameFactIdx !== -1) {
      memory.userProfile.facts.splice(nameFactIdx, 1);
    }
  }

  if (updates.customNotes !== undefined) {
    memory.userProfile.customNotes = updates.customNotes.trim();
  }
  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);
  return memory;
}

/**
 * Add or update a permanent personal fact.
 * If category is 'name' or label is 'Nome', also sets userProfile.name.
 */
export function addOrUpdatePersonalFact(
  category: PersonalFactCategory,
  label: string,
  value: string
): TutorMemory {
  const memory = getStoredMemory();
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  if (!cleanLabel || !cleanValue) return memory;

  // If label or category represents name, synchronize userProfile.name
  if (category === 'name' || cleanLabel.toLowerCase().includes('nome') || cleanLabel.toLowerCase().includes('name')) {
    memory.userProfile.name = cleanValue;
  }

  // Check if a fact with matching label or category exists
  const existingIdx = memory.userProfile.facts.findIndex(
    (f) =>
      f.label.toLowerCase() === cleanLabel.toLowerCase() ||
      (category !== 'other' && f.category === category && f.label.toLowerCase() === cleanLabel.toLowerCase())
  );

  if (existingIdx !== -1) {
    memory.userProfile.facts[existingIdx] = {
      ...memory.userProfile.facts[existingIdx],
      category,
      label: cleanLabel,
      value: cleanValue,
      updatedAt: Date.now(),
    };
  } else {
    const newFact: UserPersonalFact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category,
      label: cleanLabel,
      value: cleanValue,
      updatedAt: Date.now(),
    };
    memory.userProfile.facts.push(newFact);
  }

  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);
  return memory;
}

/**
 * Delete a specific permanent fact by ID.
 */
export function deletePersonalFact(factId: string): TutorMemory {
  const memory = getStoredMemory();
  const target = memory.userProfile.facts.find((f) => f.id === factId);
  if (target && (target.category === 'name' || target.label.toLowerCase() === 'nome')) {
    memory.userProfile.name = '';
  }
  memory.userProfile.facts = memory.userProfile.facts.filter((f) => f.id !== factId);
  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);
  return memory;
}

/**
 * Immediately record personal data discovered during an active conversation.
 * Can be called in real-time as soon as information surfaces.
 */
export function recordDiscoveredPersonalData(
  discoveredName?: string,
  discoveredFacts?: Array<{ label: string; value: string; category?: PersonalFactCategory }>
): { memory: TutorMemory; addedFacts: UserPersonalFact[] } {
  const memory = getStoredMemory();
  const addedFacts: UserPersonalFact[] = [];

  // 1. Process name
  if (discoveredName && discoveredName.trim()) {
    const name = discoveredName.trim();
    memory.userProfile.name = name;

    const nameFactIdx = memory.userProfile.facts.findIndex(
      (f) => f.category === 'name' || f.label.toLowerCase() === 'nome' || f.label.toLowerCase() === 'name'
    );
    if (nameFactIdx !== -1) {
      memory.userProfile.facts[nameFactIdx].value = name;
      memory.userProfile.facts[nameFactIdx].updatedAt = Date.now();
      addedFacts.push(memory.userProfile.facts[nameFactIdx]);
    } else {
      const fact: UserPersonalFact = {
        id: `fact-name-${Date.now()}`,
        category: 'name',
        label: 'Nome',
        value: name,
        updatedAt: Date.now(),
      };
      memory.userProfile.facts.unshift(fact);
      addedFacts.push(fact);
    }
  }

  // 2. Process other facts
  if (discoveredFacts && discoveredFacts.length > 0) {
    for (const fact of discoveredFacts) {
      if (!fact.label || !fact.value) continue;
      const cleanLabel = fact.label.trim();
      const cleanVal = fact.value.trim();
      const cat = fact.category || 'other';

      if (cat === 'name' || cleanLabel.toLowerCase().includes('nome')) {
        memory.userProfile.name = cleanVal;
      }

      const existingIdx = memory.userProfile.facts.findIndex(
        (f) => f.label.toLowerCase() === cleanLabel.toLowerCase()
      );
      if (existingIdx !== -1) {
        memory.userProfile.facts[existingIdx].value = cleanVal;
        memory.userProfile.facts[existingIdx].category = cat;
        memory.userProfile.facts[existingIdx].updatedAt = Date.now();
        addedFacts.push(memory.userProfile.facts[existingIdx]);
      } else {
        const newFact: UserPersonalFact = {
          id: `fact-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          category: cat,
          label: cleanLabel,
          value: cleanVal,
          updatedAt: Date.now(),
        };
        memory.userProfile.facts.push(newFact);
        addedFacts.push(newFact);
      }
    }
  }

  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);
  return { memory, addedFacts };
}

/**
 * Add a new session summary to the session history following FIFO principles.
 * If history length exceeds maxSessions, the oldest entries are evicted.
 * Also merges newly discovered personal facts permanently into userProfile.
 */
export function addSessionToHistory(sessionData: {
  topic: string;
  durationSeconds: number;
  summary: string;
  keyPoints?: string[];
  newPersonalFacts?: Array<{ label: string; value: string; category?: PersonalFactCategory }>;
  discoveredName?: string;
}): { memory: TutorMemory; addedItem: SessionHistoryItem } {
  // 1. Process permanent facts and name first
  const { memory } = recordDiscoveredPersonalData(
    sessionData.discoveredName,
    sessionData.newPersonalFacts
  );

  // 2. Format localized date for human readability
  const now = new Date();
  const dateFormatted = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  // 3. Create the new session history item
  const newSession: SessionHistoryItem = {
    id: `sess-${Date.now()}`,
    timestamp: Date.now(),
    dateFormatted,
    topic: sessionData.topic || 'Conversazione spontanea',
    durationSeconds: sessionData.durationSeconds || 0,
    summary: sessionData.summary || 'Chiacchierata generale in italiano.',
    keyPoints: sessionData.keyPoints || [],
    newPersonalFacts: sessionData.newPersonalFacts?.map((f) => ({
      label: f.label,
      value: f.value,
    })),
  };

  // 4. FIFO Queue management: append newest, slice to maxSessions
  const updatedHistory = [...memory.sessionHistory, newSession];
  const maxLimit = memory.maxSessions || DEFAULT_MAX_SESSIONS;

  if (updatedHistory.length > maxLimit) {
    // Drop the oldest items (FIFO: First In, First Out)
    memory.sessionHistory = updatedHistory.slice(updatedHistory.length - maxLimit);
  } else {
    memory.sessionHistory = updatedHistory;
  }

  saveStoredMemory(memory);
  return { memory, addedItem: newSession };
}

/**
 * Update the user's proficiency level based on post-lesson difficulty feedback
 * (Troppo difficile / Perfetto / Troppo facile) and optional AI assessment.
 */
export function recordDifficultyFeedback(
  choice: 'difficile' | 'perfetto' | 'facile',
  aiEstimatedScore?: number
): { memory: TutorMemory; previousScore: number | null; newScore: number; stageLabel: string } {
  const memory = getStoredMemory();
  const currentProficiency = memory.userProfile.proficiency || INITIAL_PROFICIENCY;
  const previousScore = currentProficiency.score;

  let calculatedScore: number;

  if (previousScore === null) {
    // Initial calibration response
    if (choice === 'difficile') {
      calculatedScore = 30; // Starts gently around beginner/elementary
    } else if (choice === 'perfetto') {
      calculatedScore = 50; // Solid intermediate baseline
    } else {
      calculatedScore = 70; // Advanced
    }

    if (typeof aiEstimatedScore === 'number' && !isNaN(aiEstimatedScore) && aiEstimatedScore > 0) {
      calculatedScore = Math.round((calculatedScore + aiEstimatedScore) / 2);
    }
  } else {
    // Existing score adjustment
    let delta = 0;
    if (choice === 'difficile') {
      delta = -5;
    } else if (choice === 'perfetto') {
      delta = +2; // Encouraging steady progress
    } else if (choice === 'facile') {
      delta = +6;
    }

    calculatedScore = Math.max(5, Math.min(100, previousScore + delta));

    if (typeof aiEstimatedScore === 'number' && !isNaN(aiEstimatedScore) && aiEstimatedScore > 0) {
      // 75% user feedback momentum, 25% AI assessment calibration
      calculatedScore = Math.round(calculatedScore * 0.75 + aiEstimatedScore * 0.25);
      calculatedScore = Math.max(5, Math.min(100, calculatedScore));
    }
  }

  const { stage, stageLabel, speechPaceLabel } = getProficiencyStage(calculatedScore);

  memory.userProfile.proficiency = {
    score: calculatedScore,
    stage,
    stageLabel,
    speechPaceLabel,
    lastFeedbackChoice: choice,
    totalAssessments: (currentProficiency.totalAssessments || 0) + 1,
    updatedAt: Date.now(),
  };

  // If there is an ongoing or recent session in history, tag the difficulty feedback
  if (memory.sessionHistory.length > 0) {
    const lastSession = memory.sessionHistory[memory.sessionHistory.length - 1];
    lastSession.difficultyFeedback = choice;
  }

  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);

  return {
    memory,
    previousScore,
    newScore: calculatedScore,
    stageLabel,
  };
}

/**
 * Manually set or reset the user's proficiency level (e.g. from the Profile Modal).
 * Pass null to return to "In calibrazione".
 */
export function setManualProficiency(score: number | null): TutorMemory {
  const memory = getStoredMemory();
  const { stage, stageLabel, speechPaceLabel } = getProficiencyStage(score);

  memory.userProfile.proficiency = {
    score,
    stage,
    stageLabel,
    speechPaceLabel,
    totalAssessments: (memory.userProfile.proficiency?.totalAssessments || 0) + 1,
    updatedAt: Date.now(),
  };

  memory.userProfile.updatedAt = Date.now();
  saveStoredMemory(memory);
  return memory;
}

/**
 * Clear only the session history (FIFO records), keeping the permanent user profile intact.
 */
export function clearSessionHistory(): TutorMemory {
  const memory = getStoredMemory();
  memory.sessionHistory = [];
  saveStoredMemory(memory);
  return memory;
}

/**
 * Prepare a compact, lightweight representation of memory for injection into Gemini Live.
 */
export function getCompactMemoryForLive(memory: TutorMemory) {
  const prof = memory.userProfile.proficiency || INITIAL_PROFICIENCY;
  return {
    userProfile: {
      name: memory.userProfile.name,
      proficiency: {
        score: prof.score,
        stage: prof.stage,
        stageLabel: prof.stageLabel,
        speechPaceLabel: prof.speechPaceLabel,
      },
      facts: memory.userProfile.facts.map((f) => ({
        label: f.label,
        value: f.value,
        category: f.category,
      })),
      customNotes: memory.userProfile.customNotes,
    },
    sessionHistory: memory.sessionHistory.map((s) => ({
      date: s.dateFormatted,
      topic: s.topic,
      summary: s.summary,
      keyPoints: s.keyPoints,
      difficultyFeedback: s.difficultyFeedback,
    })),
  };
}

