import React from 'react';
import { MessageSquare, Sparkles, CheckCircle2, BookOpen, Coffee, ArrowRight } from 'lucide-react';
import { LessonPhase } from '../types';

interface PhaseTrackerProps {
  currentPhase: LessonPhase;
  phaseTurns: number;
  onAdvanceToFeedback?: () => void;
  canAdvanceEarly?: boolean;
}

const PHASES = [
  {
    phase: 1 as LessonPhase,
    title: '1. Dialogo del Giorno',
    short: 'Dialogo',
    icon: MessageSquare,
    desc: 'Attualità & opinioni (nessuna correzione durante il flusso)',
  },
  {
    phase: 2 as LessonPhase,
    title: '2. Feedback & Analisi',
    short: 'Feedback',
    icon: Sparkles,
    desc: 'Massimo 2-3 espressioni per renderle più naturali',
  },
  {
    phase: 3 as LessonPhase,
    title: '3. Breve Esercizio',
    short: 'Esercizio',
    icon: BookOpen,
    desc: '1-2 esercizi mirati sugli errori analizzati',
  },
  {
    phase: 4 as LessonPhase,
    title: '4. Chiusura & Curiosità',
    short: 'Chiusura',
    icon: Coffee,
    desc: 'Domande aperte, proverbio o curiosità culturale',
  },
];

export const PhaseTracker: React.FC<PhaseTrackerProps> = ({
  currentPhase,
  phaseTurns,
  onAdvanceToFeedback,
  canAdvanceEarly,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-amber-200/60 px-4 py-3 sticky top-0 z-20 shadow-xs">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Step indicators */}
        <div className="w-full flex items-center justify-between sm:justify-start gap-1 sm:gap-2">
          {PHASES.map((p, idx) => {
            const Icon = p.icon;
            const isCurrent = currentPhase === p.phase;
            const isCompleted = currentPhase > p.phase;

            return (
              <React.Fragment key={p.phase}>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                  title={p.desc}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline">{p.title}</span>
                  <span className="sm:hidden">{p.short}</span>

                  {/* Turn counter badge for Phase 1 */}
                  {isCurrent && p.phase === 1 && (
                    <span className="ml-1 bg-amber-700/60 px-1.5 py-0.2 rounded-full text-[10px] font-semibold">
                      {Math.min(phaseTurns, 4)}/4
                    </span>
                  )}
                </div>

                {idx < PHASES.length - 1 && (
                  <div
                    className={`h-0.5 w-3 sm:w-6 rounded-full transition-colors ${
                      isCompleted ? 'bg-emerald-400' : 'bg-stone-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Action helper */}
        <div className="flex items-center gap-2 text-xs text-stone-600 shrink-0 self-end md:self-auto">
          {currentPhase === 1 && canAdvanceEarly && onAdvanceToFeedback && (
            <button
              onClick={onAdvanceToFeedback}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md border border-amber-300 transition-colors"
            >
              <span>Passa subito al feedback</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <div className="text-[11px] text-stone-500 hidden lg:block">
            {currentPhase === 1 && '💡 Parla liberamente: nessun errore verrà corretto ora.'}
            {currentPhase === 2 && '🔍 Analisi di 2-3 punti chiave per un italiano naturale.'}
            {currentPhase === 3 && '✍️ Metti in pratica quanto appreso.'}
            {currentPhase === 4 && '☕ Dubbi e un tocco di cultura italiana per chiudere.'}
          </div>
        </div>
      </div>
    </div>
  );
};
