import React from 'react';
import { X, Volume2, HelpCircle } from 'lucide-react';
import { audioService } from '../services/audioService';
import { VoiceGender } from '../types';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPhrase: (phrase: string) => void;
  teacherVoice?: VoiceGender;
}

interface HelpPhraseItem {
  it: string;
  uso: string;
}

interface HelpPhraseCategory {
  category: string;
  items: HelpPhraseItem[];
}

const PHRASES: HelpPhraseCategory[] = [
  {
    category: 'Saluti & Inizio Conversazione',
    items: [
      { it: 'Ciao Andrea! Tutto bene, grazie. E tu come stai?', uso: 'Per ricambiare con calore il saluto iniziale' },
      { it: 'Sì, mi va benissimo parlare di questo argomento!', uso: 'Per confermare con entusiasmo il tema proposto' },
      { it: 'In realtà oggi preferirei parlare della mia giornata.', uso: 'Per proporre un cambio di tema spontaneo' },
      { it: 'Cosa ne pensi tu di questo tema?', uso: 'Per invitare Andrea a condividere la sua opinione' },
    ],
  },
  {
    category: "Esprimere un'opinione",
    items: [
      { it: 'Secondo me...', uso: 'Per introdurre il proprio punto di vista con naturalezza' },
      { it: 'Dal mio punto di vista...', uso: 'Formula formale o colloquiale per esprimere una prospettiva' },
      { it: 'Penso che sia importante...', uso: 'Ottima combinazione con il congiuntivo presente' },
      { it: 'A dire la verità, credo che...', uso: 'Per dare una risposta sincera e spontanea' },
    ],
  },
  {
    category: 'Accordo & Disaccordo',
    items: [
      { it: 'Sono pienamente d’accordo con te.', uso: 'Per confermare totale intesa con l\'interlocutore' },
      { it: 'Da un lato sì, ma dall’altro lato...', uso: 'Ideale per ponderare due aspetti contrastanti' },
      { it: 'Non ne sono così sicuro, perché...', uso: 'Per dissentire con garbo ed educazione' },
      { it: 'Dipende dalla situazione.', uso: 'Formula utile per situazioni complesse o sfumate' },
    ],
  },
  {
    category: "Chiedere aiuto all'insegnante (Andrea)",
    items: [
      { it: 'Potresti ripetere un po’ più lentamente?', uso: 'Chiedere un ritmo di pronuncia più scandito' },
      { it: 'Cosa significa questa parola?', uso: 'Chiedere la definizione o il senso di un vocabolo' },
      { it: 'Come si dice in italiano...?', uso: 'Chiedere il corrispettivo o la forma naturale' },
      { it: 'Puoi spiegarlo con parole più semplici, per favore?', uso: 'Chiedere una parafrasi chiara e accessibile' },
    ],
  },
];

export const HelpDrawer: React.FC<HelpDrawerProps> = ({
  isOpen,
  onClose,
  onInsertPhrase,
  teacherVoice = 'maschile',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-stone-200">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-700" />
            <h2 className="font-serif-italian text-lg font-bold text-stone-900">
              Frasario per la Conversazione
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {PHRASES.map((section, idx) => (
            <div key={idx} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2 hover:border-amber-300 transition-colors"
                  >
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => {
                        onInsertPhrase(item.it);
                        onClose();
                      }}
                      title="Clicca per inserire nel messaggio"
                    >
                      <p className="text-sm font-medium text-stone-900">{item.it}</p>
                      <p className="text-xs text-stone-500 italic">{item.uso}</p>
                    </div>

                    <button
                      onClick={() =>
                        audioService.playItalianText(item.it, {
                          voice: teacherVoice === 'femminile' ? 'Kore' : 'Puck',
                        })
                      }
                      className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors"
                      title="Ascolta pronuncia"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
