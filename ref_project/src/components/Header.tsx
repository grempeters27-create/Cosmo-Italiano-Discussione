import React from 'react';
import { Radio, Bookmark, HelpCircle, Volume2, Gauge, Newspaper, UserCheck, Sparkles } from 'lucide-react';
import { DailyTopic, VoiceGender, UserProficiency } from '../types';

interface HeaderProps {
  currentTopic: DailyTopic;
  onOpenTopicSelector: () => void;
  onOpenNotebook: () => void;
  onOpenHelp: () => void;
  onOpenLiveCall: () => void;
  onOpenMemoryModal?: () => void;
  userProficiency?: UserProficiency;
  notebookCount: number;
  speechSpeed: 'normal' | 'slow';
  onToggleSpeed: () => void;
  isAutoplayAudio: boolean;
  onToggleAutoplay: () => void;
  teacherVoice: VoiceGender;
  onToggleTeacherVoice: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTopic,
  onOpenTopicSelector,
  onOpenNotebook,
  onOpenHelp,
  onOpenLiveCall,
  onOpenMemoryModal,
  userProficiency,
  notebookCount,
  speechSpeed,
  onToggleSpeed,
  isAutoplayAudio,
  onToggleAutoplay,
  teacherVoice,
  onToggleTeacherVoice,
}) => {
  return (
    <header className="bg-white border-b border-amber-200/80 px-4 py-3 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm ring-2 ring-amber-200/60">
            🇮🇹
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif-italian text-lg sm:text-xl font-bold text-stone-900 leading-tight">
                Andrea
              </h1>
              <button
                onClick={onOpenMemoryModal}
                className="text-[10px] font-bold px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200/80"
                title="Livello linguistico adattivo: clicca per aprire il profilo permanente"
              >
                {userProficiency?.score !== null && userProficiency?.score !== undefined ? (
                  <>
                    <span className="font-mono tabular-nums">{userProficiency.score}/100</span>
                    <span className="text-amber-600">·</span>
                    <span>{userProficiency.stageLabel}</span>
                  </>
                ) : (
                  <span>🌱 In calibrazione</span>
                )}
              </button>
            </div>
            <p className="text-xs text-stone-500 hidden sm:block">
              Il tuo insegnante personale di conversazione italiana
            </p>
          </div>
        </div>

        {/* Topic Pill */}
        <button
          onClick={onOpenTopicSelector}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 transition-colors text-left max-w-[200px] sm:max-w-xs truncate"
          title="Clicca per cambiare argomento"
        >
          <Newspaper className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <div className="truncate">
            <span className="text-[10px] text-stone-400 block uppercase font-semibold leading-none">
              Tema del Giorno
            </span>
            <span className="text-xs font-medium text-stone-800 truncate block">
              {currentTopic.title}
            </span>
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Voice Gender Segmented Selector (Andrea Uomo / Andrea Donna) */}
          <div
            className="flex items-center rounded-xl bg-stone-100 p-0.5 border border-stone-200"
            title="Scegli la voce del tuo insegnante Andrea (Uomo o Donna)"
          >
            <button
              onClick={() => {
                if (teacherVoice !== 'maschile') onToggleTeacherVoice();
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                teacherVoice === 'maschile'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Voce Andrea: Maschile (Puck)"
            >
              <span className="text-xs">👨</span>
              <span className="text-[11px]">Uomo</span>
            </button>
            <button
              onClick={() => {
                if (teacherVoice !== 'femminile') onToggleTeacherVoice();
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                teacherVoice === 'femminile'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Voce Andrea: Femminile (Kore)"
            >
              <span className="text-xs">👩</span>
              <span className="text-[11px]">Donna</span>
            </button>
          </div>

          {/* Live Call Button (Gemini 3.8 Live) */}
          <button
            onClick={onOpenLiveCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm active:scale-98 transition-all"
            title="Avvia una telefonata vocale in tempo reale (Live API)"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Chiamata Live</span>
            <span className="sm:hidden">Live</span>
          </button>

          {/* Speed Toggle (1.0x vs 0.8x) */}
          <button
            onClick={onToggleSpeed}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              speechSpeed === 'slow'
                ? 'bg-amber-100 border-amber-400 text-amber-900'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
            title={speechSpeed === 'slow' ? 'Velocità: 0.8x (Lenta & Scandita)' : 'Velocità: 1.0x (Naturale)'}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{speechSpeed === 'slow' ? '0.8x' : '1.0x'}</span>
          </button>

          {/* Autoplay Audio Toggle */}
          <button
            onClick={onToggleAutoplay}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              isAutoplayAudio
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-stone-50 border-stone-200 text-stone-400 hover:bg-stone-100'
            }`}
            title={isAutoplayAudio ? 'Audio automatico attivo' : 'Audio automatico disattivato'}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Notebook Button */}
          <button
            onClick={onOpenNotebook}
            className="relative p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 transition-colors"
            title="Apri Quaderno dei Vocaboli"
          >
            <Bookmark className="w-4 h-4 text-amber-800" />
            {notebookCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                {notebookCount}
              </span>
            )}
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 transition-colors"
            title="Frasario utile per la conversazione"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
