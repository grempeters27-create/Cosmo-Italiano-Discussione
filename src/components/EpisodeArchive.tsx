import React from 'react';
import { PodcastEpisode } from '../types.ts';
import { Calendar, Clock, ChevronRight, Archive, Check } from 'lucide-react';

interface EpisodeArchiveProps {
  episodes: PodcastEpisode[];
  currentEpisodeId: string;
  isLoadingAnalysis?: boolean;
  onSelectEpisode: (episode: PodcastEpisode) => void;
}

export const EpisodeArchive: React.FC<EpisodeArchiveProps> = ({
  episodes,
  currentEpisodeId,
  isLoadingAnalysis = false,
  onSelectEpisode,
}) => {
  if (!episodes || episodes.length <= 1) {
    return null;
  }

  return (
    <section id="archivio" className="my-12">
      <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-amber-800" />
          <h3 className="font-serif text-xl md:text-2xl font-semibold text-stone-900">
            Archivio Recente COSMO Italiano
          </h3>
        </div>
        <span className="text-xs font-mono text-stone-500">
          Feed Ufficiale WDR ({episodes.length} puntate disponibili)
        </span>
      </div>

      <div className="space-y-3">
        {episodes.map((ep, idx) => {
          const isSelected = ep.id === currentEpisodeId;
          const formattedDate = ep.pubDate
            ? new Date(ep.pubDate).toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '';

          return (
            <div
              key={ep.id || idx}
              onClick={() => onSelectEpisode(ep)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isSelected
                  ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50'
                  : 'bg-white border-stone-200/80 hover:border-stone-300 hover:bg-stone-50/50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formattedDate}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="tabular-nums">{ep.duration}</span>
                  </span>
                  {idx === 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-800 font-semibold uppercase tracking-wider text-[11px]">
                        Ultima Puntata Live
                      </span>
                    </>
                  )}
                </div>

                <h4 className="font-serif text-base font-semibold text-stone-900">
                  {ep.title}
                </h4>

                <p className="text-xs text-stone-600 line-clamp-2 max-w-3xl leading-relaxed">
                  {ep.description}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                {isSelected ? (
                  isLoadingAnalysis ? (
                    <span className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/90 rounded-lg flex items-center gap-1.5 animate-pulse">
                      <div className="w-3 h-3 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                      <span>Ricerca Fonti Esterne...</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/80 rounded-lg flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Dossier Attivo</span>
                    </span>
                  )
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEpisode(ep);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Carica nel Dossier</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
