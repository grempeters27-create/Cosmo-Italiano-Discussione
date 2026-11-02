// Audio utilities for Italian Speech Synthesis and Speech Recognition

export interface SpeechRecognitionResultItem {
  transcript: string;
  isFinal: boolean;
}

export function getItalianVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(
    (v) => v.lang.toLowerCase().startsWith('it') || v.lang.toLowerCase().includes('ita')
  );
}

export function pickBestItalianFemaleVoice(): SpeechSynthesisVoice | null {
  const italianVoices = getItalianVoices();
  if (italianVoices.length === 0) return null;

  // Preferred female names in common speech synthesis engines
  const preferredNames = [
    'alice',
    'federica',
    'elsa',
    'chiara',
    'giulia',
    'paola',
    'lucia',
    'cosimo',
    'google italiano',
    'natural',
  ];

  for (const name of preferredNames) {
    const found = italianVoices.find((v) => v.name.toLowerCase().includes(name));
    if (found) return found;
  }

  // Fallback to any Italian voice
  return italianVoices[0];
}

export function speakItalianText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onError) onError('Speech synthesis not supported');
    return null;
  }

  window.speechSynthesis.cancel(); // Stop any pending speech

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 0.95; // Clear, calm cadence
  utterance.pitch = 1.0;

  const voice = pickBestItalianFemaleVoice();
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    if (onEnd) onEnd();
    if (onError) onError(e);
  };

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Browser speech recognition support detector
export function getSpeechRecognitionConstructor(): any {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    (window as any).mozSpeechRecognition ||
    (window as any).msSpeechRecognition ||
    null
  );
}
