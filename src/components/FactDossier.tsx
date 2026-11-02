import React, { useState } from 'react';
import { FactItem } from '../types.ts';
import { Sparkles, CheckCircle2, ExternalLink, ArrowUpRight, Newspaper } from 'lucide-react';
import { FactDetailModal } from './FactDetailModal.tsx';
import { isDirectArticleUrl } from '../utils/dossierEngine.ts';

interface FactDossierProps {
  facts: FactItem[] | null;
  topic: string;
  isLoading?: boolean;
}

export const FactDossier: React.FC<FactDossierProps> = ({ facts, topic, isLoading = false }) => {
  const [selectedFact, setSelectedFact] = useState<FactItem | null>(null);
  const [localFacts, setLocalFacts] = useState<FactItem[]>([]);
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (facts && facts.length > 0) {
      setLocalFacts(facts.slice(0, 3));
    } else {
      setLocalFacts([]);
    }
  }, [facts]);

  const handleOpenArticle = async (e: React.MouseEvent, item: FactItem, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if the link is a genuine full-text article (not a search or category portal)
    const isDirect = isDirectArticleUrl(item.sourceUrl);

    if (isDirect && item.sourceUrl) {
      window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Open placeholder window immediately to prevent browser popup blocking
    const newTab = window.open('about:blank', '_blank');
    setResolvingIndex(index);

    try {
      const res = await fetch(
        `/api/articles/resolve?episodeTitle=${encodeURIComponent(topic)}&country=${encodeURIComponent(
          item.sourceCountry || (index === 0 ? 'Germania' : index === 1 ? 'Italia' : 'Bruxelles / UE')
        )}&preferredOutlet=${encodeURIComponent(item.sourceOrCategory || '')}&factTitle=${encodeURIComponent(
          item.fact || ''
        )}&currentUrl=${encodeURIComponent(item.sourceUrl || '')}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.directUrl) {
          if (newTab) newTab.location.href = data.directUrl;

          // Update local card state if outlet changed or url resolved
          setLocalFacts((prev) => {
            const next = [...prev];
            if (next[index]) {
              next[index] = {
                ...next[index],
                sourceUrl: data.directUrl,
                sourceOrCategory: data.sourceOrCategory || next[index].sourceOrCategory,
                sourceLanguage: data.sourceLanguage || next[index].sourceLanguage,
              };
            }
            return next;
          });

          // Also update selectedFact if modal is open
          setSelectedFact((curr) => {
            if (!curr || curr.id !== item.id) return curr;
            return {
              ...curr,
              sourceUrl: data.directUrl,
              sourceOrCategory: data.sourceOrCategory || curr.sourceOrCategory,
              sourceLanguage: data.sourceLanguage || curr.sourceLanguage,
            };
          });
          return;
        }
      }
      if (newTab) newTab.location.href = item.sourceUrl || item.searchUrl || 'https://news.google.com';
    } catch (err) {
      console.warn('On-the-fly resolution error:', err);
      if (newTab) newTab.location.href = item.sourceUrl || item.searchUrl || 'https://news.google.com';
    } finally {
      setResolvingIndex(null);
    }
  };

  if (!isLoading && (!localFacts || localFacts.length === 0)) {
    return null;
  }

  const displayFacts = localFacts;

  return (
    <section id="fatti" className="my-12">
      {/* Editorial Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6 pb-3 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-800 mb-1">
            <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>
              {isLoading
                ? 'Ricerca Web & Rassegna Stampa Internazionale in Corso...'
                : 'Rassegna Stampa Europea & Ricerca Indipendente'}
            </span>
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-stone-900">
            Dossier Fatti & Approfondimenti
          </h2>
        </div>
        <p className="text-xs text-stone-500 max-w-md">
          {isLoading
            ? 'Ricerca stampa comparata (tedesca, italiana ed europea) in corso per:'
            : "Tre prospettive di stampa indipendenti (tedesca, italiana ed europea) interamente incentrate su:"}{' '}
          <span className="font-medium text-stone-700 italic">{topic}</span>.
          <span className="block mt-0.5 text-amber-800 font-medium">
            Clicca su una scheda per aprire la sintesi dettagliata della ricerca.
          </span>
        </p>
      </div>

      {isLoading ? (
        /* Dynamic 3-card Research Loading State */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[
            {
              step: '01',
              title: 'Stampa Tedesca (Inland)',
              desc: 'Inchieste e reazioni politiche di Der Spiegel, FAZ, Süddeutsche Zeitung e Bundestag sul protagonista...',
            },
            {
              step: '02',
              title: 'Stampa Italiana (Punto di vista da Roma)',
              desc: 'Corriere della Sera, Repubblica e ANSA: come il caso viene seguito e commentato in Italia...',
            },
            {
              step: '03',
              title: 'Stampa Europea & Comunitaria',
              desc: 'Politico Europe, Reuters e risoluzioni dell\'Unione Europea sull\'impatto continentale del dossier...',
            },
          ].map((card, idx) => (
            <div
              key={idx}
              className="bg-white/80 rounded-2xl p-6 border border-stone-200 flex flex-col justify-between shadow-xs min-h-[220px]"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-stone-400 mb-3 pb-2 border-b border-stone-100 font-mono">
                  <span className="text-[11px] uppercase tracking-wider text-amber-700/80 font-medium">Fase di Ricerca</span>
                  <span>{card.step}</span>
                </div>
                <h4 className="font-serif text-base font-semibold text-stone-800 mb-2 leading-snug">
                  {card.title}
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between text-xs text-amber-800">
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <div className="w-2.5 h-2.5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                  <span>Ricerca fonti esterne...</span>
                </span>
                <span className="text-stone-400 font-mono text-[10px]">COSMO IA</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Interactive 3-Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayFacts.map((item, index) => (
            <div
              key={index}
              onClick={() => setSelectedFact(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedFact(item);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Apri approfondimento: ${item.fact}`}
              className="group bg-white rounded-2xl p-6 border border-stone-200/90 hover:border-amber-700/60 transition-all flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-700/40 text-left"
            >
              <div>
                {/* Unboxed Metadata with Typographic Separator */}
                <div className="flex items-center justify-between text-xs text-stone-500 mb-3 pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-amber-900/90 font-medium tracking-wide uppercase truncate max-w-[82%]">
                    <Newspaper className="w-3 h-3 text-amber-700 shrink-0" />
                    <span className="truncate">{item.sourceOrCategory || 'Stampa Internazionale'}</span>
                    {item.sourceCountry && (
                      <>
                        <span aria-hidden="true" className="text-stone-300">·</span>
                        <span className="text-stone-500 font-sans normal-case">{item.sourceCountry}</span>
                      </>
                    )}
                    {item.sourceLanguage && (
                      <>
                        <span aria-hidden="true" className="text-stone-300">·</span>
                        <span className="text-stone-400 font-sans normal-case">{item.sourceLanguage}</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-stone-400 font-medium">0{index + 1}</span>
                </div>

                <h4 className="font-serif text-base font-semibold text-stone-900 group-hover:text-amber-950 mb-2.5 leading-snug transition-colors">
                  {item.fact}
                </h4>

                <p className="text-sm text-stone-600 leading-relaxed line-clamp-3">
                  {item.context}
                </p>
              </div>

              {/* Bottom Card Affordance */}
              <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span className="flex items-center gap-1.5 text-emerald-800 font-medium text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Dato verificato</span>
                </span>

                <div className="flex items-center gap-2">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFact(item);
                    }}
                    role="button"
                    tabIndex={0}
                    className="inline-flex items-center gap-1 text-[11px] text-stone-600 hover:text-stone-900 font-medium transition-colors cursor-pointer"
                    title="Apri la sintesi giornalistica in lingua italiana"
                  >
                    <span>Leggi sintesi</span>
                  </span>

                  <span aria-hidden="true" className="text-stone-300">·</span>

                  <button
                    type="button"
                    onClick={(e) => handleOpenArticle(e, item, index)}
                    disabled={resolvingIndex === index}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    title={`Apri direttamente l'articolo originale su ${item.sourceOrCategory || 'testata'}`}
                  >
                    {resolvingIndex === index ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                        <span>Apertura articolo...</span>
                      </>
                    ) : (
                      <>
                        <span>Apri articolo</span>
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Central Detail Popup Modal */}
      <FactDetailModal
        fact={selectedFact}
        topicTitle={topic}
        onClose={() => setSelectedFact(null)}
      />
    </section>
  );
};
