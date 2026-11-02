import React, { useState } from 'react';
import {
  X,
  User,
  Clock,
  Sparkles,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  Heart,
  Briefcase,
  MapPin,
  Target,
  Smile,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { TutorMemory, PersonalFactCategory, UserPersonalFact } from '../types';
import {
  updateUserProfile,
  addOrUpdatePersonalFact,
  deletePersonalFact,
  clearSessionHistory,
  setManualProficiency,
} from '../services/memoryService';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: TutorMemory;
  onMemoryUpdate: (updated: TutorMemory) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  memory,
  onMemoryUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

  // Profile edit states
  const [nameInput, setNameInput] = useState(memory.userProfile.name);
  const [notesInput, setNotesInput] = useState(memory.userProfile.customNotes || '');
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  // New fact form states
  const [newCategory, setNewCategory] = useState<PersonalFactCategory>('location');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAddingFact, setIsAddingFact] = useState(false);

  // Sync inputs when memory prop changes
  React.useEffect(() => {
    setNameInput(memory.userProfile.name);
    setNotesInput(memory.userProfile.customNotes || '');
  }, [memory]);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateUserProfile({
      name: nameInput,
      customNotes: notesInput,
    });
    onMemoryUpdate(updated);
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  const handleAddFactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newValue.trim()) return;
    const updated = addOrUpdatePersonalFact(newCategory, newLabel.trim(), newValue.trim());
    onMemoryUpdate(updated);
    setNewLabel('');
    setNewValue('');
    setIsAddingFact(false);
  };

  const handleDeleteFact = (id: string) => {
    const updated = deletePersonalFact(id);
    onMemoryUpdate(updated);
  };

  const handleClearHistory = () => {
    if (window.confirm('Vuoi davvero cancellare la cronologia delle sessioni? I tuoi dati anagrafici permanenti (nome, città, ecc.) rimarranno intatti.')) {
      const updated = clearSessionHistory();
      onMemoryUpdate(updated);
    }
  };

  const getCategoryIcon = (category: PersonalFactCategory) => {
    switch (category) {
      case 'name':
        return <User className="w-3.5 h-3.5 text-amber-400" />;
      case 'location':
        return <MapPin className="w-3.5 h-3.5 text-sky-400" />;
      case 'profession':
        return <Briefcase className="w-3.5 h-3.5 text-emerald-400" />;
      case 'interests':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'learning_goals':
        return <Target className="w-3.5 h-3.5 text-amber-400" />;
      case 'family_or_pets':
        return <Smile className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-stone-400" />;
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-stone-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between gap-3 bg-stone-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-bold text-lg shadow-md shadow-amber-900/30">
              🧠
            </div>
            <div>
              <h2 className="font-serif-italian text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Memoria & Profilo di Andrea
              </h2>
              <p className="text-xs text-stone-400">
                Cosa ricorda il tutor su di te e storico delle sessioni recenti
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-amber-400 text-amber-300 bg-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profilo Permanente</span>
            {memory.userProfile.name && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                {memory.userProfile.name}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-300 bg-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Cronologia Sessioni (FIFO)</span>
            <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono">
              {memory.sessionHistory.length}/{memory.maxSessions}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: PERMANENT USER PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Permanent Info Disclaimer Card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-amber-300">Dati Permanenti:</strong> Andrea memorizza queste informazioni per conoscerti come un vero amico. Non vengono mai cancellate a rotazione e vengono consultate prima di ogni telefonata.
                </div>
              </div>

              {/* Adaptive Language Proficiency Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-900/90 border border-amber-500/30 text-left space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                      📈
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Livello di Competenza Linguistica
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                          Adattivo
                        </span>
                      </h3>
                      <p className="text-xs text-stone-400">
                        Valutato continuamente da Andrea in base alle tue lezioni e al tuo riscontro
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {memory.userProfile.proficiency?.score !== null && memory.userProfile.proficiency?.score !== undefined ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">
                            {memory.userProfile.proficiency.score}
                          </span>
                          <span className="text-xs text-stone-500 font-medium">/100</span>
                          <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 border border-stone-700">
                            {memory.userProfile.proficiency.stageLabel}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-300/90 font-mono bg-stone-800/80 px-2 py-0.5 rounded border border-stone-700/60 flex items-center gap-1">
                          <span>🎙️</span>
                          <span>{memory.userProfile.proficiency.speechPaceLabel || (memory.userProfile.proficiency.score <= 35 ? 'Lento & Scandito' : 'Rilassato & Naturale')}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🌱 In calibrazione
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 rounded-full bg-stone-800 overflow-hidden relative border border-stone-700/60">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 transition-all duration-500 rounded-full"
                      style={{
                        width: `${memory.userProfile.proficiency?.score ?? 15}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                    <span>0 Principiante (Lento)</span>
                    <span>35 Base</span>
                    <span>60 Intermedio</span>
                    <span>80 Avanzato</span>
                    <span>100 Fluente</span>
                  </div>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed pt-1 border-t border-stone-800/80">
                  Andrea regola automaticamente la conversazione su questa scala: a punteggi più bassi (0-35) parla a <strong>ritmo notevolmente più lento</strong>, fa pause tra le frasi e usa un vocabolario essenziale. Parla con te come un vero amico sincero: niente complimenti teatrali esagerati, ma <strong>consigli amichevoli e costruttivi</strong> per migliorare le frasi direttamente nel dialogo.
                </p>

                {/* Manual Adjustment controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">Regolazione manuale:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = memory.userProfile.proficiency?.score ?? 50;
                        const next = Math.max(5, current - 5);
                        const updated = setManualProficiency(next);
                        onMemoryUpdate(updated);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono font-semibold border border-stone-700 transition-colors cursor-pointer"
                      title="Abbassa di 5 punti"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = memory.userProfile.proficiency?.score ?? 50;
                        const next = Math.min(100, current + 5);
                        const updated = setManualProficiency(next);
                        onMemoryUpdate(updated);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono font-semibold border border-stone-700 transition-colors cursor-pointer"
                      title="Alza di 5 punti"
                    >
                      +5
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Vuoi azzerare il livello tornando a "In calibrazione"? Andrea calibrerà nuovamente la conversazione in modo aperto.')) {
                        const updated = setManualProficiency(null);
                        onMemoryUpdate(updated);
                      }
                    }}
                    className="text-stone-400 hover:text-amber-300 underline text-[11px] transition-colors cursor-pointer"
                  >
                    Reimposta in calibrazione aperta
                  </button>
                </div>
              </div>

              {/* Name & Notes Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                      Il tuo Nome / Come vuoi che ti chiami Andrea:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Es. Marco, Anna, Luca..."
                        className="w-full bg-stone-800/90 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                      Note e preferenze personali generali:
                    </label>
                    <input
                      type="text"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="Es. Mi piace la Toscana, preferisco parlare di viaggi..."
                      className="w-full bg-stone-800/90 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-stone-400">
                    {isSavedFeedback && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-fadeIn">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Profilo salvato con successo!
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salva Profilo</span>
                  </button>
                </div>
              </form>

              {/* Permanent Facts List */}
              <div className="pt-4 border-t border-stone-800">
                {/* Active Student Name Highlight Card if known */}
                {memory.userProfile.name && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-base shrink-0">
                        👤
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                          Nome dello Studente (Permanente)
                        </span>
                        <p className="text-sm font-bold text-white">
                          {memory.userProfile.name}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-semibold shrink-0">
                      Attivo
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Informazioni Personali Memorizzate
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Rilevate spontaneamente durante le conversazioni o inserite manualmente
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddingFact(!isAddingFact)}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Aggiungi info</span>
                  </button>
                </div>

                {/* Add Fact Inline Form */}
                {isAddingFact && (
                  <form
                    onSubmit={handleAddFactSubmit}
                    className="p-3.5 rounded-2xl bg-stone-800/90 border border-amber-500/40 mb-4 space-y-3 animate-fadeIn"
                  >
                    <span className="text-xs font-bold text-amber-300 block">
                      Aggiungi un'informazione permanente che Andrea deve ricordare:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                          Categoria
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as PersonalFactCategory)}
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                        >
                          <option value="location">📍 Città / Luogo</option>
                          <option value="profession">💼 Professione / Lavoro</option>
                          <option value="interests">❤️ Hobby / Passioni</option>
                          <option value="family_or_pets">🐾 Famiglia / Animali</option>
                          <option value="learning_goals">🎯 Obiettivo Studio</option>
                          <option value="other">✨ Altro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                          Etichetta
                        </label>
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="Es. Città natale, Cane, Chitarra..."
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-stone-400 uppercase font-semibold mb-1">
                          Valore / Dettaglio
                        </label>
                        <input
                          type="text"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder="Es. Berlino, Leo (Golden Retriever)..."
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingFact(false)}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        disabled={!newLabel.trim() || !newValue.trim()}
                        className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 font-bold text-xs cursor-pointer transition-all"
                      >
                        Salva Dato
                      </button>
                    </div>
                  </form>
                )}

                {/* Facts Grid */}
                {memory.userProfile.facts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-stone-800/40 border border-stone-800 text-center">
                    <p className="text-xs text-stone-400">
                      Nessun dato personale ancora salvato.
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Parla con Andrea o inseriscili sopra: Andrea li ricorderà in tutte le sessioni!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {memory.userProfile.facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="p-3 rounded-2xl bg-stone-800/70 border border-stone-700/80 flex items-start justify-between gap-2.5 group hover:border-amber-500/40 transition-all"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-xl bg-stone-900 border border-stone-700 shrink-0 mt-0.5">
                            {getCategoryIcon(fact.category)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block truncate">
                              {fact.label}
                            </span>
                            <p className="text-xs sm:text-sm font-semibold text-white mt-0.5 truncate">
                              {fact.value}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFact(fact.id)}
                          className="opacity-60 group-hover:opacity-100 text-stone-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-stone-700/50 transition-all cursor-pointer"
                          title="Elimina questo dato"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FIFO SESSION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* FIFO Info Banner */}
              <div className="p-3.5 rounded-2xl bg-stone-800/80 border border-stone-700/80 text-xs text-stone-300 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">
                      Archivio Sessioni a Rotazione (FIFO)
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                      Andrea conserva la sintesi delle ultime <strong className="text-amber-300">{memory.maxSessions} sessioni</strong>. All'arrivo di nuove sessioni, le più datate vengono eliminate automaticamente (FIFO: First-In, First-Out), mantenendo il contesto agile e aggiornato.
                    </p>
                  </div>
                </div>

                {memory.sessionHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="shrink-0 text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Svuota storico
                  </button>
                )}
              </div>

              {/* History Items */}
              {memory.sessionHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-stone-800/40 border border-stone-800">
                  <Calendar className="w-8 h-8 text-stone-600 mb-2" />
                  <p className="text-sm font-semibold text-stone-300">
                    Nessuna sessione archiviata finora.
                  </p>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm">
                    Dopo ogni telefonata (dopo aver agganciato), Andrea salverà automaticamente qui una sintesi della conversazione che rileggerà all'inizio della chiamata successiva!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...memory.sessionHistory].reverse().map((sess, idx) => (
                    <div
                      key={sess.id}
                      className="p-4 rounded-2xl bg-stone-800/70 border border-stone-700/80 text-left space-y-2 relative hover:border-stone-600 transition-all"
                    >
                      {/* Top Header of item */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-700/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">
                            #{memory.sessionHistory.length - idx}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {sess.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-stone-400">
                          {sess.difficultyFeedback && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-900 border border-stone-700 font-medium">
                              {sess.difficultyFeedback === 'difficile' && '🔴 Troppo difficile'}
                              {sess.difficultyFeedback === 'perfetto' && '🎯 Perfetto'}
                              {sess.difficultyFeedback === 'facile' && '🔵 Troppo facile'}
                            </span>
                          )}
                          <span>{sess.dateFormatted}</span>
                          {sess.durationSeconds > 0 && (
                            <span className="font-mono text-stone-500">
                              {formatSeconds(sess.durationSeconds)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-xs sm:text-sm text-amber-200 leading-relaxed font-medium">
                        "{sess.summary}"
                      </p>

                      {/* Key Points */}
                      {sess.keyPoints && sess.keyPoints.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {sess.keyPoints.map((pt, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-[10px] px-2.5 py-0.5 rounded-lg bg-stone-900/80 border border-stone-700 text-stone-300"
                            >
                              • {pt}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Newly Discovered Personal Facts from this session */}
                      {sess.newPersonalFacts && sess.newPersonalFacts.length > 0 && (
                        <div className="pt-2 border-t border-stone-800/80 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            Dati appresi:
                          </span>
                          {sess.newPersonalFacts.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-medium"
                            >
                              {f.label}: {f.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-stone-800 bg-stone-900/60 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Memoria persistente attiva per tutte le telefonate</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold cursor-pointer transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
