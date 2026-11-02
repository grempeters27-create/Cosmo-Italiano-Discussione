/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PodcastEpisode, EpisodeAnalysis } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { PodcastPlayer } from './components/PodcastPlayer.tsx';
import { EpisodeSummary } from './components/EpisodeSummary.tsx';
import { FactDossier } from './components/FactDossier.tsx';
import { LiveAudioMode } from './components/LiveAudioMode.tsx';
import { EpisodeArchive } from './components/EpisodeArchive.tsx';
import { Radio, AlertCircle, Headphones } from 'lucide-react';

import { buildTopicDossier } from './utils/dossierEngine.ts';

export default function App() {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [analysis, setAnalysis] = useState<EpisodeAnalysis | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Directly starts in Audio Mode as requested!
  const [activeView, setActiveView] = useState<'audio' | 'editorial'>('audio');

const DEFAULT_EPISODE: PodcastEpisode = {
  id: 'fallback-latest',
  title: "Matilde Keizer, l'italiana che fa ridere i tedeschi",
  description:
    "Matilde è un astro nascente della stand-up comedy tedesca. Figlia di un'italiana e di un tedesco è cresciuta a Roma e ha studiato recitazione a New York, prima di stabilirsi a Berlino. Ai microfoni di Francesco Marzano racconta come nascono i suoi spettacoli pieni di ironia, e soprattutto autoironia, tra malintesi culturali e aneddoti familiari.",
  pubDate: 'Fri, 30 Oct 2026 15:00:18 GMT',
  duration: '00:20:00',
  author: 'Francesco Marzano',
  audioUrl:
    'https://wdrmedien-a.akamaihd.net/media/p/public/weltweit/2026/10/30/d11b9391-2212-4d2f-aaee-5ab04fcdb00b/d11b9391-2212-4d2f-aaee-5ab04fcdb00b_MP3-128.mp3',
  link: 'https://www1.wdr.de/mediathek/audio/cosmo/italienisch/audio-matilde-keizer-litaliana-che-fa-ridere-i-tedeschi-100.html',
  imageUrl: 'https://www1.wdr.de/mediathek/audio/sendereihen-bilder/cosmo-italienisch-neu-100~_v-Podcast.jpg',
};

  // Load live feed on startup
  const loadEpisodes = async (force = false) => {
    try {
      if (force) setIsRefreshing(true);
      else setIsLoadingFeed(true);
      setFeedError(null);

      const res = await fetch(`/api/episodes${force ? '?refresh=true' : ''}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error('Formato feed non valido');
      }

      if (!data || !data.success || !Array.isArray(data.episodes) || data.episodes.length === 0) {
        throw new Error(data?.error || 'Nessun episodio trovato nel feed WDR');
      }

      setEpisodes(data.episodes);

      // Automatically select the absolute latest episode (index 0)
      if (!currentEpisode || force) {
        const latest = data.episodes[0];
        setCurrentEpisode(latest);
        loadAnalysis(latest);
      }
    } catch (err: any) {
      console.warn('Notice fetching live episodes:', err);
      setFeedError('Impossibile caricare il feed WDR in tempo reale. Verrà utilizzata una versione archiviata.');
      if (episodes.length === 0) {
        setEpisodes([DEFAULT_EPISODE]);
        if (!currentEpisode) {
          setCurrentEpisode(DEFAULT_EPISODE);
          loadAnalysis(DEFAULT_EPISODE);
        }
      }
    } finally {
      setIsLoadingFeed(false);
      setIsRefreshing(false);
    }
  };

  // Analyze selected episode with Gemini server-side & research facts (fully fault-tolerant)
  const loadAnalysis = async (episode: PodcastEpisode, force = false) => {
    if (!episode) return;
    try {
      setIsLoadingAnalysis(true);
      const res = await fetch('/api/episodes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode, force }),
      });

      if (res.ok) {
        try {
          const data = await res.json();
          if (data && data.success && data.analysis && Array.isArray(data.analysis.facts) && data.analysis.facts.length > 0) {
            setAnalysis(data.analysis);
            return;
          }
        } catch {
          // Body wasn't valid JSON, fall through safely to topic dossier
        }
      }

      // If server returned non-200 or unexpected payload, synthesize topic dossier
      setAnalysis(buildTopicDossier(episode));
    } catch {
      // Network or parsing error: ensure 3 tailored fact cards always display
      setAnalysis(buildTopicDossier(episode));
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, []);

  const handleSelectEpisode = (ep: PodcastEpisode) => {
    setCurrentEpisode(ep);
    // Crucial: clear old analysis immediately so the user sees on-demand generation for the newly selected topic
    setAnalysis(null);
    loadAnalysis(ep, true);
    // Stay in editorial/dossier view to allow reading facts and summary
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col selection:bg-amber-100 selection:text-amber-950">
      {/* Top Bar Navigation */}
      <Navbar
        activeView={activeView}
        onSelectView={setActiveView}
        onRefreshFeed={() => loadEpisodes(true)}
        isRefreshing={isRefreshing}
        hasAudioModeActive={activeView === 'audio'}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Feed error notice */}
        {feedError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{feedError}</span>
            </div>
            <button
              onClick={() => loadEpisodes(true)}
              className="text-amber-800 font-semibold hover:underline cursor-pointer ml-4"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Global Loading Spinner for initial boot */}
        {isLoadingFeed && !currentEpisode && (
          <div className="py-24 flex flex-col items-center justify-center gap-4 text-stone-500">
            <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-serif text-lg text-stone-800">Connessione a WDR COSMO Italiano...</p>
              <p className="text-xs font-mono text-stone-500">
                Rilevamento in tempo reale dell'ultima puntata pubblicata nel feed
              </p>
            </div>
          </div>
        )}

        {/* Main Content Area: Default starts in Audio Mode */}
        {currentEpisode && (
          <>
            {activeView === 'audio' ? (
              /* View 1 (Default): Real-time Full-Duplex Audio Mode with Silvia da Firenze */
              <LiveAudioMode
                episode={currentEpisode}
                analysis={analysis}
                onOpenDossier={() => setActiveView('editorial')}
              />
            ) : (
              /* View 2: Editorial Dossier & Podcast Explorer */
              <div>
                {/* Hero Broadcaster Marquee */}
                <div className="mb-8 border-b border-stone-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-800 mb-2">
                      <Radio className="w-3.5 h-3.5 text-amber-700" />
                      <span>Radio Pubblica Tedesca · Westdeutscher Rundfunk (WDR)</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-stone-500 font-sans normal-case">Live Feed Ufficiale</span>
                    </div>
                    <h2 className="font-serif text-3xl md:text-5xl font-normal text-stone-950 tracking-tight">
                      COSMO Italiano
                    </h2>
                    <p className="text-sm md:text-base text-stone-600 mt-2 max-w-2xl font-serif italic">
                      Un tema al giorno, approfondito con fatti e prospettive diverse. Capire meglio la politica,
                      la scienza e la vita tra Italia e Germania.
                    </p>
                  </div>

                </div>

                {/* Official Audio Player from WDR */}
                <div className="mb-10">
                  <PodcastPlayer
                    title={currentEpisode.title}
                    audioUrl={currentEpisode.audioUrl}
                    duration={currentEpisode.duration}
                    link={currentEpisode.link}
                    author={currentEpisode.author}
                  />
                </div>

                {/* Structured Episode Summary */}
                <EpisodeSummary
                  episode={currentEpisode}
                  analysis={analysis}
                  isLoading={isLoadingAnalysis}
                />

                {/* Real-time Fact-Checking & Web Grounded Dossier */}
                <FactDossier
                  facts={analysis?.facts || null}
                  topic={currentEpisode.title}
                  isLoading={isLoadingAnalysis}
                />

                {/* Episode Archive */}
                <EpisodeArchive
                  episodes={episodes}
                  currentEpisodeId={currentEpisode.id}
                  isLoadingAnalysis={isLoadingAnalysis}
                  onSelectEpisode={handleSelectEpisode}
                />

                {/* Single Centralized Floating Action Dock: Start conversation with Silvia */}
                <aside
                  aria-label="Avvia conversazione vocale con Silvia"
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] bg-stone-900/95 text-stone-100 backdrop-blur-md border border-stone-800 shadow-2xl rounded-2xl p-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-4 transition-all"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Headphones className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-400">
                        <span>Silvia da Firenze</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-stone-400 normal-case font-sans">Pronta al dialogo vocale</span>
                      </div>
                      <p className="text-xs text-stone-200 truncate font-medium">
                        {currentEpisode.title}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveView('audio');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 bg-amber-700 hover:bg-amber-600 active:scale-95 text-white font-medium text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0 whitespace-nowrap"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse text-amber-200" />
                    <span>Parla con Silvia</span>
                  </button>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white/80 py-8 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-stone-900">COSMO Italiano Studio</span>
            <span>·</span>
            <span>WDR Westdeutscher Rundfunk Köln</span>
          </div>

          <div className="flex items-center gap-4 text-stone-400">
            <span>Gemini 3.8 Live API & Web Audio API</span>
            <span>·</span>
            <span className="font-mono tabular-nums">2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
