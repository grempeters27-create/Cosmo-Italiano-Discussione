import React from 'react';
import { X, Bookmark, Volume2, Trash2, Download, BookOpen } from 'lucide-react';
import { NotebookEntry, VoiceGender } from '../types';
import { audioService } from '../services/audioService';

interface VocabNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: NotebookEntry[];
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  teacherVoice?: VoiceGender;
}

export const VocabNotebookModal: React.FC<VocabNotebookModalProps> = ({
  isOpen,
  onClose,
  entries,
  onDeleteEntry,
  onClearAll,
  teacherVoice = 'maschile',
}) => {
  if (!isOpen) return null;

  const handlePlay = (text: string) => {
    audioService.playItalianText(text, {
      voice: teacherVoice === 'femminile' ? 'Kore' : 'Puck',
    });
  };

  const handleExport = () => {
    const textContent = entries
      .map(
        (e, idx) =>
          `${idx + 1}. [${e.category}] ${e.naturalForm}\n   Origine: "${e.phrase}"\n   Spiegazione: ${e.explanation}\n   Data: ${e.date}\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([`IL MIO QUADERNO DI ITALIANO\n\n${textContent}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quaderno-italiano-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-italian text-xl font-bold text-stone-900">
                Quaderno dei Vocaboli & Correzioni
              </h2>
              <p className="text-xs text-stone-600">
                {entries.length} {entries.length === 1 ? 'espressione salvata' : 'espressioni salvate'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-stone-400 space-y-3">
              <Bookmark className="w-12 h-12 mx-auto stroke-1 text-stone-300" />
              <p className="text-sm font-medium text-stone-600">Il tuo quaderno è ancora vuoto</p>
              <p className="text-xs max-w-sm mx-auto text-stone-500">
                Clicca sull'icona del segnalibro accanto a una correzione o a un proverbio per salvarlo qui e ripassarlo quando vuoi.
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-xl bg-stone-50/80 border border-stone-200 space-y-2 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {entry.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePlay(entry.naturalForm)}
                      className="p-1.5 text-stone-500 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors"
                      title="Ascolta"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteEntry(entry.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Rimuovi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-sm font-semibold text-stone-900">
                  "{entry.naturalForm}"
                </div>

                {entry.phrase && (
                  <div className="text-xs text-stone-500 italic">
                    Forma precedente: "{entry.phrase}"
                  </div>
                )}

                <div className="text-xs text-stone-700 bg-white p-2.5 rounded-lg border border-stone-100">
                  {entry.explanation}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <button
              onClick={onClearAll}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors"
            >
              Svuota tutto
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Esporta Appunti (.txt)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
