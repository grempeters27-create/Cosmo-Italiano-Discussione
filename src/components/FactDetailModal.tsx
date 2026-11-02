import React, { useEffect, useState } from 'react';
import { FactItem } from '../types.ts';
import { X, ExternalLink, Newspaper, BookOpen, Globe } from 'lucide-react';
import { isDirectArticleUrl } from '../utils/dossierEngine.ts';

interface FactDetailModalProps {
  fact: FactItem | null;
  topicTitle: string;
  onClose: () => void;
}

export const FactDetailModal: React.FC<FactDetailModalProps> = ({ fact, topicTitle, onClose }) => {
  // Always invoke all hooks at the top level unconditionally
  const [isResolving, setIsResolving] = useState(false);
  const [currentFact, setCurrentFact] = useState<FactItem | null>(fact);

  useEffect(() => {
    setCurrentFact(fact);
  }, [fact]);

  // Lock body scroll and register Escape key listener while modal is open
  useEffect(() => {
    if (!fact) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fact, onClose]);

  // Early return only after all hooks have been called
  if (!fact || !currentFact) return null;

  // Generate safe fallback detailed summary if not yet populated
  const summaryParagraphs = currentFact.detailedSummary
    ? currentFact.detailedSummary.split('\n\n').filter((p) => p.trim().length > 0)
    : [
        currentFact.context,
        `Questo approfondimento fa riferimento ai riscontri pubblicati da ${currentFact.sourceOrCategory || 'organi di stampa europei ed internazionali'} in merito all'inchiesta o alla notizia trattata in questa puntata di COSMO Italiano.`,
      ];

  const insights = currentFact.keyInsights && currentFact.keyInsights.length > 0
    ? currentFact.keyInsights
    : [
        'Dati e posizioni confermate da testate internazionali indipendenti.',
        'Contesto normativo o scientifico di rilevanza europea.',
      ];

  const relevance = currentFact.relevanceToPodcast ||
    `Questo riscontro approfondisce le questioni toccate nel podcast "${topicTitle}", offrendo elementi concreti e prospettive esterne per comprendere a fondo le implicazioni del tema.`;

  // Fallback language determination
  const displayLanguage = currentFact.sourceLanguage || (
    currentFact.sourceCountry === 'Germania'
      ? 'Tedesco (Deutsch)'
      : currentFact.sourceCountry === 'Italia'
        ? 'Italiano'
        : 'Originale europeo'
  );

  const handleOpenDirectArticle = async (e: React.MouseEvent) => {
    e.preventDefault();
    const url = currentFact.sourceUrl;
    const isDirect = isDirectArticleUrl(url);
    if (isDirect && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const newTab = window.open('about:blank', '_blank');
    setIsResolving(true);
    try {
      const res = await fetch(
        `/api/articles/resolve?episodeTitle=${encodeURIComponent(topicTitle)}&country=${encodeURIComponent(
          currentFact.sourceCountry || 'Germania'
        )}&preferredOutlet=${encodeURIComponent(currentFact.sourceOrCategory || '')}&factTitle=${encodeURIComponent(
          currentFact.fact || ''
        )}&currentUrl=${encodeURIComponent(currentFact.sourceUrl || '')}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.directUrl) {
          if (newTab) newTab.location.href = data.directUrl;
          setCurrentFact((prev) => (prev ? {
            ...prev,
            sourceUrl: data.directUrl,
            sourceOrCategory: data.sourceOrCategory || prev.sourceOrCategory,
            sourceLanguage: data.sourceLanguage || prev.sourceLanguage,
          } : null));
          return;
        }
      }
      if (newTab) newTab.location.href = currentFact.sourceUrl || currentFact.searchUrl || 'https://news.google.com';
    } catch (err) {
      console.warn('Resolution notice:', err);
      if (newTab) newTab.location.href = currentFact.sourceUrl || currentFact.searchUrl || 'https://news.google.com';
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-stone-900/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-fact-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#FAF8F5] rounded-2xl border border-stone-200/90 shadow-2xl p-6 sm:p-8 my-8 text-stone-900 transition-all transform scale-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon: Clean Unboxed Press & Language Metadata */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono uppercase tracking-wider text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <Newspaper className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{currentFact.sourceOrCategory || 'Stampa di Riferimento'}</span>
            </div>
            {currentFact.sourceCountry && (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="text-stone-600 font-sans normal-case font-medium">{currentFact.sourceCountry}</span>
              </>
            )}
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="inline-flex items-center gap-1 text-stone-600 font-sans normal-case font-medium">
              <Globe className="w-3 h-3 text-stone-400 shrink-0" />
              <span>Lingua: {currentFact.sourceLanguage || displayLanguage}</span>
            </span>
            {currentFact.publishedDate && (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="text-stone-400 font-sans normal-case">{currentFact.publishedDate}</span>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 -mt-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Chiudi finestra"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Core Headline */}
        <div className="mt-5 mb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-stone-500 block mb-1">
            Approfondimento Giornalistico Esterno
          </span>
          <h3
            id="modal-fact-title"
            className="font-serif text-2xl sm:text-3xl font-semibold text-stone-950 leading-snug"
          >
            {currentFact.fact}
          </h3>
        </div>

        {/* Primary Narrative Summary */}
        <div className="space-y-4 text-stone-700 text-sm sm:text-base leading-relaxed font-sans border-b border-stone-200 pb-6">
          {summaryParagraphs.map((para, idx) => (
            <p key={idx} className={idx === 0 ? 'text-stone-800 font-medium' : ''}>
              {para}
            </p>
          ))}
        </div>

        {/* Key Takeaways / Punti Chiave */}
        <div className="my-6">
          <h4 className="text-xs font-mono uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-800" />
            <span>Punti Chiave della Ricerca</span>
          </h4>
          <ul className="space-y-2.5">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700 mt-2 shrink-0" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Connection to Podcast */}
        <div className="mb-8 p-4 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs sm:text-sm text-amber-950">
          <span className="font-semibold block mb-1 font-mono text-[11px] uppercase tracking-wider text-amber-900">
            Rilevanza per l'episodio di COSMO Italiano
          </span>
          <p className="leading-relaxed text-amber-900/90">{relevance}</p>
        </div>

        {/* Footer Actions: Explicit Article Link & Press Review */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-stone-200">
          <div className="text-xs text-stone-500 font-sans">
            <span>Fonte verificata: </span>
            <span className="font-semibold text-stone-800">{currentFact.sourceOrCategory || 'Testata estera'}</span>
            <span className="text-stone-400"> ({currentFact.sourceLanguage || displayLanguage})</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Chiudi
            </button>

            {/* Primary Action: Direct Original Article Link with On-the-Fly Resolver */}
            <button
              type="button"
              onClick={handleOpenDirectArticle}
              disabled={isResolving}
              className="px-4 py-2 text-xs font-medium text-white bg-amber-900 hover:bg-amber-950 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer font-sans disabled:opacity-70"
              title={`Apri direttamente l'articolo su ${currentFact.sourceOrCategory || 'questa testata'}`}
            >
              {isResolving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Risoluzione link in corso...</span>
                </>
              ) : (
                <>
                  <span>Apri articolo su {currentFact.sourceOrCategory || 'fonte originale'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
