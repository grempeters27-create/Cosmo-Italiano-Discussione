import React, { useState } from 'react';
import { BookOpen, CheckCircle, HelpCircle, Send, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { ExerciseItem, VoiceGender } from '../types';
import { audioService } from '../services/audioService';

interface ExerciseCardProps {
  exercises: ExerciseItem[];
  onSubmitExerciseAnswer: (answer: string) => void;
  isSubmitting?: boolean;
  teacherVoice?: VoiceGender;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercises,
  onSubmitExerciseAnswer,
  isSubmitting,
  teacherVoice = 'maschile',
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const [isListeningForId, setIsListeningForId] = useState<string | null>(null);
  const [isTranscribingForId, setIsTranscribingForId] = useState<string | null>(null);

  if (!exercises || exercises.length === 0) return null;

  const handleSpeechInput = async (exerciseId: string) => {
    if (isListeningForId === exerciseId) {
      // Stop recording and transcribe
      setIsListeningForId(null);
      setIsTranscribingForId(exerciseId);
      try {
        const text = await audioService.stopVoiceCaptureAndTranscribe();
        if (text) {
          setAnswers((prev) => ({ ...prev, [exerciseId]: text }));
        }
      } catch (err) {
        console.warn('Exercise speech transcribe failed:', err);
      } finally {
        setIsTranscribingForId(null);
      }
      return;
    }

    // Cancel any other recording
    audioService.cancelVoiceCapture();
    setIsListeningForId(exerciseId);

    const started = await audioService.startVoiceCapture({
      onInterimText: (liveText) => {
        if (liveText) {
          setAnswers((prev) => ({ ...prev, [exerciseId]: liveText }));
        }
      },
      onError: () => {
        setIsListeningForId(null);
        setIsTranscribingForId(null);
      },
    });

    if (!started) {
      setIsListeningForId(null);
    }
  };

  const handlePlayQuestion = (text: string) => {
    audioService.playItalianText(text, {
      voice: teacherVoice === 'femminile' ? 'Kore' : 'Puck',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const combined = exercises
      .map((ex, idx) => {
        const ans = answers[ex.id] || '';
        return `Esercizio ${idx + 1}: ${ans}`;
      })
      .join(' | ');

    if (combined.trim()) {
      onSubmitExerciseAnswer(combined);
    }
  };

  return (
    <div className="my-4 p-5 rounded-2xl bg-sky-50/90 border border-sky-300 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-sky-200/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-bold">
            3
          </span>
          <h3 className="font-serif-italian text-lg font-semibold text-stone-900">
            Breve Esercizio Pratico
          </h3>
        </div>
        <span className="text-xs text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full font-medium">
          Metti subito in pratica
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {exercises.map((ex, idx) => (
          <div
            key={ex.id || idx}
            className="p-4 rounded-xl bg-white border border-sky-200/80 shadow-2xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                Esercizio {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => handlePlayQuestion(ex.question)}
                title="Ascolta la frase"
                className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-stone-900 font-medium text-sm leading-relaxed">{ex.question}</p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={
                    isListeningForId === ex.id
                      ? 'In ascolto della tua voce... Clicca per terminare'
                      : isTranscribingForId === ex.id
                      ? 'Trascrizione con IA in corso...'
                      : 'Scrivi qui la tua risposta...'
                  }
                  value={answers[ex.id] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [ex.id]: e.target.value }))
                  }
                  disabled={isTranscribingForId === ex.id}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => handleSpeechInput(ex.id)}
                  title="Rispondi a voce in italiano"
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    isListeningForId === ex.id
                      ? 'bg-rose-500 text-white animate-pulse'
                      : isTranscribingForId === ex.id
                      ? 'text-sky-600'
                      : 'text-stone-400 hover:text-stone-700'
                  }`}
                >
                  {isTranscribingForId === ex.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isListeningForId === ex.id ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {ex.hint && (
                <button
                  type="button"
                  onClick={() =>
                    setShowHints((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                  }
                  className="p-2 text-stone-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-stone-200 text-xs flex items-center gap-1"
                  title="Mostra suggerimento"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Aiuto</span>
                </button>
              )}
            </div>

            {isListeningForId === ex.id && (
              <p className="text-[11px] text-rose-600 font-medium animate-pulse">
                🎤 Registrazione in corso: rispondi a voce e riclicca l'icona per trascrivere.
              </p>
            )}

            {showHints[ex.id] && ex.hint && (
              <p className="text-xs text-sky-800 bg-sky-50/80 p-2 rounded-md border border-sky-200">
                💡 <span className="font-medium">Suggerimento:</span> {ex.hint}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-sky-600 hover:bg-sky-700 active:scale-98 transition-all shadow-sm disabled:opacity-50"
          >
            <span>Verifica risposta con Andrea</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
