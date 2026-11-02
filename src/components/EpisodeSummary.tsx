import React from 'react';
import { PodcastEpisode, EpisodeAnalysis } from '../types.ts';
import { Check, Calendar, Clock, User } from 'lucide-react';

interface EpisodeSummaryProps {
  episode: PodcastEpisode;
  analysis: EpisodeAnalysis | null;
  isLoading: boolean;
  onEnterAudioMode?: () => void;
}

export const EpisodeSummary: React.FC<EpisodeSummaryProps> = ({
  episode,
  analysis,
  isLoading,
  onEnterAudioMode,
}) => {
  return (
    <section id="sintesi" className="my-10">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 md:p-8 shadow-xs">
        {/* Episode header */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-3 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>{episode.pubDate ? new Date(episode.pubDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Ottobre 2026'}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span className="tabular-nums">{episode.duration} min</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-stone-400" />
            <span>{episode.author}</span>
          </span>
        </div>

        <h1 className="font-serif text-2xl md:text-4xl font-bold text-stone-900 tracking-tight mb-4 leading-tight">
          {episode.title}
        </h1>

        <p className="text-base text-stone-700 leading-relaxed font-serif italic mb-6 text-stone-600/90 border-b border-stone-100 pb-5">
          «{episode.description}»
        </p>

        {/* Loading state for deep analysis */}
        {isLoading && (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-stone-500">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Generazione sintesi e ricerca fatti correlati in corso...</p>
          </div>
        )}

        {/* Detailed Analysis */}
        {analysis && !isLoading && (
          <div className="space-y-6">
            <div>
              <h3 className="font-serif text-lg font-semibold text-stone-900 mb-2">
                Sintesi Editoriale della Puntata
              </h3>
              <div className="text-stone-700 text-sm md:text-base leading-relaxed space-y-3 whitespace-pre-line">
                {analysis.summary}
              </div>
            </div>

            {/* Key points */}
            {analysis.keyPoints && analysis.keyPoints.length > 0 && (
              <div className="pt-4 border-t border-stone-100">
                <h4 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-3">
                  Punti Chiave del Confronto
                </h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {analysis.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-stone-700 bg-[#FAF8F5] p-3 rounded-lg border border-stone-100">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs shrink-0 font-medium">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
