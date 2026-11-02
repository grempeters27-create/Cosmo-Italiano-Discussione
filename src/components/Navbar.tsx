import React from 'react';
import { Radio, Headphones, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeView: 'editorial' | 'audio';
  onSelectView: (view: 'editorial' | 'audio') => void;
  onRefreshFeed: () => void;
  isRefreshing: boolean;
  hasAudioModeActive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onSelectView,
  onRefreshFeed,
  isRefreshing,
  hasAudioModeActive,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectView('editorial')}
          className="text-left font-serif text-xl font-bold tracking-tight text-stone-900 hover:text-amber-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
        >
          <Radio className="w-5 h-5 text-amber-700" />
          <span>COSMO Italiano Studio</span>
        </button>

        {/* Zone 2: 4-5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
          <button
            onClick={() => onSelectView('editorial')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:text-stone-900 ${
              activeView === 'editorial' ? 'text-stone-950 font-semibold' : ''
            }`}
          >
            Ultima Puntata
          </button>
          <a
            href="#sintesi"
            onClick={() => onSelectView('editorial')}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
          >
            Sintesi Podcast
          </a>
          <a
            href="#fatti"
            onClick={() => onSelectView('editorial')}
            className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
          >
            Fatti & Ricerca Web
          </a>
          <button
            onClick={onRefreshFeed}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            title="Aggiorna feed da WDR Cosmo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-700' : ''}`} />
            <span>Verifica Nuove Puntate</span>
          </button>
        </nav>

        {/* Zone 3: Return to Dossier action available only when in Audio Mode */}
        {activeView === 'audio' && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectView('editorial')}
              className="px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 bg-stone-800 text-stone-100 hover:bg-stone-700 shadow-sm"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Torna al Dossier</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
