import React, { useState } from 'react';
import { Coffee, Volume2, Bookmark, Check, Sparkles, RotateCcw } from 'lucide-react';
import { audioService } from '../services/audioService';
import { VoiceGender } from '../types';

interface CulturalTipCardProps {
  tip: string;
  onSaveToNotebook: (phrase: string, explanation: string) => void;
  onRestartLesson: () => void;
  teacherVoice?: VoiceGender;
}

export const CulturalTipCard: React.FC<CulturalTipCardProps> = ({
  tip,
  onSaveToNotebook,
  onRestartLesson,
  teacherVoice = 'maschile',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!tip) return null;

  const handlePlay = () => {
    setIsPlaying(true);
    audioService.playItalianText(tip, {
      voice: teacherVoice === 'femminile' ? 'Kore' : 'Puck',
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const handleSave = () => {
    onSaveToNotebook(tip, 'Proverbio o curiosità culturale del giorno');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="my-4 p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-amber-700 text-white flex items-center justify-center">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif-italian text-lg font-semibold text-stone-900">
              Proverbio & Curiosità del Giorno
            </h3>
            <p className="text-xs text-stone-600">Un tocco di autentica cultura italiana</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePlay}
            title="Ascolta con voce italiana"
            className={`p-2 rounded-lg transition-colors ${
              isPlaying
                ? 'bg-amber-200 text-amber-900 animate-pulse'
                : 'text-stone-600 hover:text-stone-900 hover:bg-amber-100'
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            title="Salva nel Quaderno"
            className="p-2 text-stone-600 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-600" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white/90 border border-amber-200 shadow-2xs">
        <p className="font-serif-italian text-base sm:text-lg italic text-amber-950 leading-relaxed">
          "{tip}"
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-xs text-stone-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Ottimo lavoro per oggi! Ti aspetto per la prossima conversazione.</span>
        </span>

        <button
          onClick={onRestartLesson}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 shadow-2xs hover:shadow-xs transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
          <span>Nuova Lezione / Cambia Tema</span>
        </button>
      </div>
    </div>
  );
};
