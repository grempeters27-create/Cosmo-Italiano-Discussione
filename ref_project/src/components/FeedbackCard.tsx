import React, { useState } from 'react';
import { Volume2, Bookmark, Check, Languages, HelpCircle } from 'lucide-react';
import { FeedbackItem, VoiceGender } from '../types';
import { audioService } from '../services/audioService';

interface FeedbackCardProps {
  items: FeedbackItem[];
  onSaveToNotebook: (item: FeedbackItem) => void;
  onRequestDetailedExplanation?: () => void;
  isDetailedExplanationLoading?: boolean;
  detailedExplanationText?: string;
  teacherVoice?: VoiceGender;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  items,
  onSaveToNotebook,
  onRequestDetailedExplanation,
  isDetailedExplanationLoading,
  detailedExplanationText,
  teacherVoice = 'maschile',
}) => {
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [showDetailed, setShowDetailed] = useState(false);

  const handlePlay = (text: string, idx: number) => {
    setPlayingIndex(idx);
    audioService.playItalianText(text, {
      speed: 'normal',
      voice: teacherVoice === 'femminile' ? 'Kore' : 'Puck',
      onEnd: () => setPlayingIndex(null),
      onError: () => setPlayingIndex(null),
    });
  };

  const handleSave = (item: FeedbackItem, idx: number) => {
    onSaveToNotebook(item);
    setSavedIndex(idx);
    setTimeout(() => setSavedIndex(null), 2500);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="my-4 p-5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
            2
          </span>
          <h3 className="font-serif-italian text-lg font-semibold text-stone-900">
            Analisi & Come dirlo più naturalmente
          </h3>
        </div>

        <button
          onClick={() => {
            setShowDetailed(!showDetailed);
            if (!showDetailed && !detailedExplanationText && onRequestDetailedExplanation) {
              onRequestDetailedExplanation();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors shadow-2xs"
        >
          <Languages className="w-3.5 h-3.5 text-amber-700" />
          <span>{showDetailed ? 'Nascondi approfondimento' : 'Approfondimento didattico'}</span>
        </button>
      </div>

      <div className="grid gap-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-white border border-amber-200/60 shadow-2xs space-y-2.5 transition-all hover:border-amber-300"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                Punto {idx + 1} • {item.category || 'Miglioramento'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePlay(item.correction, idx)}
                  title="Ascolta la pronuncia naturale"
                  className={`p-1.5 rounded-md transition-colors ${
                    playingIndex === idx
                      ? 'bg-amber-100 text-amber-700 animate-pulse'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSave(item, idx)}
                  title="Salva nel Quaderno dei Vocaboli"
                  className="p-1.5 text-stone-500 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors"
                >
                  {savedIndex === idx ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/60">
                <p className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider mb-0.5">
                  Cosa hai detto:
                </p>
                <p className="text-stone-800 italic line-through decoration-rose-400">
                  "{item.original}"
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                  <span>Più naturale:</span>
                  <span className="text-[10px] text-emerald-700 font-normal">✨ Madrelingua</span>
                </p>
                <p className="text-stone-900 font-medium">"{item.correction}"</p>
              </div>
            </div>

            <div className="text-xs text-stone-600 pt-1 flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold text-stone-700">Perché: </span>
                {item.explanation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showDetailed && (
        <div className="p-3.5 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-stone-800 space-y-1.5">
          <p className="font-semibold text-amber-950 flex items-center gap-1.5">
            <Languages className="w-4 h-4" />
            <span>Approfondimento didattico & Regola grammaticale:</span>
          </p>
          {isDetailedExplanationLoading ? (
            <p className="italic text-stone-600">Caricamento approfondimento...</p>
          ) : (
            <p className="leading-relaxed">
              {detailedExplanationText ||
                'In italiano si preferisce questa formulazione idiomatica naturale, più elegante e usata spontaneamente dai madrelingua nella vita quotidiana.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
