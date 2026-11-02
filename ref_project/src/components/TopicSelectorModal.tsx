import React, { useState } from 'react';
import { X, Sparkles, Newspaper, ChevronRight, Dices, RefreshCw, Compass } from 'lucide-react';
import { CURATED_TOPICS, TOPIC_CATEGORIES, getRandomTopicForCategory } from '../data/curatedTopics';
import { DailyTopic, TopicCategoryId } from '../types';

interface TopicSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (topic: DailyTopic) => void;
  currentTopicId: string;
}

export const TopicSelectorModal: React.FC<TopicSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTopic,
  currentTopicId,
}) => {
  const [activeCategory, setActiveCategory] = useState<TopicCategoryId>('cultura');
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleSelectCategory = async (catId: TopicCategoryId) => {
    setActiveCategory(catId);
    await generateTopicForCategory(catId);
  };

  const generateTopicForCategory = async (catId: TopicCategoryId) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catId, excludeTopicId: currentTopicId }),
      });
      if (res.ok) {
        const topic: DailyTopic = await res.json();
        onSelectTopic(topic);
      } else {
        const fallback = getRandomTopicForCategory(catId, currentTopicId);
        onSelectTopic(fallback);
      }
    } catch (_) {
      const fallback = getRandomTopicForCategory(catId, currentTopicId);
      onSelectTopic(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;

    const custom: DailyTopic = {
      id: `custom-${Date.now()}`,
      title: customTopic.slice(0, 32),
      category: 'Argomento Personalizzato',
      categoryDe: 'Argomento Personalizzato',
      italianHeadline: customTopic,
      description: 'Discussione scelta liberamente dallo studente',
      starterPrompt: `Oggi parliamo di un tema che mi sta a cuore: "${customTopic}". Cosa ne pensi tu, Andrea?`,
    };

    onSelectTopic(custom);
    setCustomTopic('');
    onClose();
  };

  const filteredTopics = CURATED_TOPICS.filter((t) => t.categoryId === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-stone-900 rounded-3xl shadow-2xl border border-stone-800 text-stone-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-italian text-xl font-bold text-white">
                Scegli l'area tematica
              </h2>
              <p className="text-xs text-stone-400">
                Scegli una categoria: l'IA selezionerà un argomento stimolante come spunto iniziale
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Defined Topic Categories */}
        <div className="p-4 border-b border-stone-800 bg-stone-950/40">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2 px-1">
            5 Aree tematiche
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {TOPIC_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs'
                      : 'bg-stone-800/60 border-stone-700/70 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{cat.icon}</span>
                    {isActive && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>
                  <span className="text-xs font-semibold mt-2 line-clamp-2 leading-tight">
                    {cat.title || cat.titleIt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action bar inside category */}
        <div className="px-5 py-3 border-b border-stone-800 flex items-center justify-between bg-stone-900/60 text-xs">
          <span className="text-stone-400">
            Categoria: <span className="text-amber-300 font-medium">{TOPIC_CATEGORIES.find(c => c.id === activeCategory)?.title || TOPIC_CATEGORIES.find(c => c.id === activeCategory)?.titleIt}</span>
          </span>
          <button
            onClick={() => generateTopicForCategory(activeCategory)}
            disabled={isGenerating}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Dices className="w-3.5 h-3.5" />
            )}
            <span>{isGenerating ? 'Ricerca in corso...' : 'Estrai un altro tema'}</span>
          </button>
        </div>

        {/* Topic List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {filteredTopics.map((topic) => {
            const isSelected = topic.id === currentTopicId;
            return (
              <button
                key={topic.id}
                onClick={() => {
                  onSelectTopic(topic);
                  onClose();
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500 text-white ring-1 ring-amber-400/50'
                    : 'bg-stone-800/40 border-stone-800 hover:border-stone-700 hover:bg-stone-800/80 text-stone-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700 text-amber-400">
                      {topic.category}
                    </span>
                    {topic.isNewsResearched && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 border border-sky-800">
                        🔍 Notizie
                      </span>
                    )}
                    {topic.gameType && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-950/80 text-violet-300 border border-violet-800">
                        🎲 Gioco: {topic.gameType}
                      </span>
                    )}
                    {topic.grammarFocus && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800">
                        💡 Grammatica
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-white text-sm">{topic.title}</h4>
                  <p className="text-xs text-amber-200/90 font-serif-italian italic">
                    "{topic.italianHeadline}"
                  </p>
                  <p className="text-[11px] text-stone-400">{topic.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-500 shrink-0" />
              </button>
            );
          })}

          {/* Custom topic form */}
          <div className="pt-4 border-t border-stone-800">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-2">
              Oppure proponi un tuo argomento
            </span>
            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Es. Le mie prossime vacanze in Sicilia, la cucina regionale, la musica..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-stone-800/80 border border-stone-700 rounded-xl text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!customTopic.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
              >
                Imposta
              </button>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <div className="p-3 bg-stone-950/80 border-t border-stone-800 text-center text-[11px] text-stone-400">
          💡 L'argomento serve solo come spunto iniziale. Durante la conversazione sei sempre libero di parlare di qualsiasi cosa!
        </div>
      </div>
    </div>
  );
};
