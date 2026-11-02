import React, { useState, useEffect, useRef } from 'react';
import { PodcastEpisode, EpisodeAnalysis, ChatMessage } from '../types.ts';
import {
  speakItalianText,
  stopSpeaking,
  getSpeechRecognitionConstructor,
  pickBestItalianFemaleVoice,
} from '../utils/audio.ts';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Headphones,
  RotateCcw,
  Info,
  Radio,
  ArrowLeft,
} from 'lucide-react';

interface SilviaAudioModeProps {
  episode: PodcastEpisode;
  analysis: EpisodeAnalysis | null;
  onExit: () => void;
}

export const SilviaAudioMode: React.FC<SilviaAudioModeProps> = ({
  episode,
  analysis,
  onExit,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [autoSpeakReply, setAutoSpeakReply] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [hasStartedIntro, setHasStartedIntro] = useState(false);
  const [useGeminiTTS, setUseGeminiTTS] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);

  const isSendingRef = useRef<boolean>(false);

  // Initialize Silvia's greeting on mount
  useEffect(() => {
    const introText =
      analysis?.silviaIntro ||
      `Ciao, sono Silvia da Firenze. Nel nostro incontro di oggi approfondiamo il podcast di COSMO italiano dedicato a "${episode.title}". ${episode.description.slice(0, 140)}... Vorrei chiederti: qual è la tua opinione su questo tema, oppure ci sono domande specifiche che vorresti farmi per cominciare?`;

    const initialMsg: ChatMessage = {
      id: 'intro-msg',
      role: 'silvia',
      text: introText,
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([initialMsg]);

    return () => {
      stopSpeaking();
      if (currentAudioElemRef.current) {
        currentAudioElemRef.current.pause();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [episode.id, analysis]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // Play a text using selected TTS (Web Speech or Gemini API)
  const playSpeech = async (text: string) => {
    stopSpeaking();
    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
    }

    if (useGeminiTTS) {
      try {
        setIsSpeaking(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = await res.json();
          const audioSrc = data?.audioUrl || (data?.audio ? `data:audio/wav;base64,${data.audio}` : null);
          if (data && data.success && audioSrc) {
            const audio = new Audio(audioSrc);
            currentAudioElemRef.current = audio;
            audio.onended = () => setIsSpeaking(false);
            audio.onerror = () => {
              setIsSpeaking(false);
              // Fallback to browser Web Speech
              speakItalianText(text, () => setIsSpeaking(true), () => setIsSpeaking(false));
            };
            await audio.play();
            return;
          }
        }
      } catch (err) {
        console.warn('Gemini TTS failed, falling back to Web Speech:', err);
      }
    }

    // Default Web Speech
    speakItalianText(
      text,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
      (err) => {
        console.warn('Speech synthesis error:', err);
        setIsSpeaking(false);
      }
    );
  };

  const startIntroduction = () => {
    setHasStartedIntro(true);
    const firstMsg = messages[0];
    if (firstMsg) {
      playSpeech(firstMsg.text);
    }
  };

  // Setup Web Speech Recognition
  const toggleListening = () => {
    setSpeechError(null);

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    // Stop Silvia if she's speaking
    stopSpeaking();
    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
    }
    setIsSpeaking(false);

    const SpeechRec = getSpeechRecognitionConstructor();
    if (!SpeechRec) {
      setSpeechError(
        'Il tuo browser non supporta il riconoscimento vocale Web Speech nativo. Puoi comunque utilizzare la casella di testo qui sotto per parlare con Silvia.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.lang = 'it-IT';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let finalTxt = '';
        let interimTxt = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTxt += event.results[i][0].transcript;
          } else {
            interimTxt += event.results[i][0].transcript;
          }
        }

        if (interimTxt) {
          setInterimTranscript(interimTxt);
        }

        if (finalTxt && !isSendingRef.current) {
          setInterimTranscript('');
          try {
            recognition.stop();
          } catch {}
          setIsListening(false);
          handleUserSend(finalTxt);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError(
            'Accesso al microfono non consentito. Verifica i permessi del browser per consentire la voce.'
          );
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Errore audio (${event.error}). Puoi digitare la tua risposta.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Cannot start speech recognition:', err);
      setIsListening(false);
      setSpeechError('Impossibile avviare il microfono. Puoi digitare la tua risposta.');
    }
  };

  const handleUserSend = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isSendingRef.current || isLoadingReply) return;
    isSendingRef.current = true;

    setInputText('');
    setInterimTranscript('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoadingReply(true);
    setSpeechError(null);

    try {
      // Build history for Gemini
      const apiHistory = newHistory.map((m) => ({
        role: m.role === 'silvia' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.text }],
      }));

      let replyText = '';
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: apiHistory.slice(-6),
            episodeTitle: episode.title,
            episodeSummary: analysis?.summary || episode.description,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.reply) {
            replyText = data.reply;
          }
        }
      } catch (networkErr) {
        console.warn('Network chat fetch error, engaging fallback dialogue:', networkErr);
      }

      if (!replyText) {
        replyText = `È una considerazione stimolante sul tema di "${episode.title}". Come evidenziava anche COSMO italiano, questo aspetto coinvolge riflessioni profonde sul piano europeo. Tu come la vedi?`;
      }

      const silviaReply: ChatMessage = {
        id: `silvia-${Date.now()}`,
        role: 'silvia',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, silviaReply]);
      setIsLoadingReply(false);
      isSendingRef.current = false;

      if (autoSpeakReply) {
        playSpeech(replyText);
      }
    } catch (err: any) {
      console.error('Send error:', err);
      setIsLoadingReply(false);
      isSendingRef.current = false;
    }
  };

  const activeVoice = pickBestItalianFemaleVoice();

  return (
    <div className="max-w-4xl mx-auto my-6 px-4">
      {/* Studio Header Card */}
      <div className="bg-stone-900 text-stone-100 rounded-3xl p-6 md:p-8 shadow-xl border border-stone-800 relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 mb-6 relative z-10">
          <button
            onClick={onExit}
            className="text-xs font-mono text-stone-400 hover:text-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Torna al Dossier</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-stone-300">Studio Audio Attivo</span>
          </div>
        </div>

        {/* Central Persona Spotlight */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <Radio className="w-3.5 h-3.5 text-amber-500" />
              <span>Conversazione Vocale Madrelingua</span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-stone-50">
              Silvia da Firenze
            </h2>
            <p className="text-xs md:text-sm text-stone-300 max-w-lg leading-relaxed">
              Tono sobrio, cordiale e orientato ai fatti. Discute con te dell'ultimo tema di COSMO italiano:{' '}
              <span className="text-amber-200 font-serif italic">{episode.title}</span>.
            </p>
          </div>

          {/* Soundwave Visualizer Graphic */}
          <div className="flex items-center gap-1.5 h-14 px-5 bg-stone-950/80 rounded-2xl border border-stone-800 shrink-0">
            {[4, 12, 24, 38, 20, 32, 16, 28, 44, 22, 14, 6].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-200 ${
                  isSpeaking
                    ? 'bg-amber-400 animate-soundwave'
                    : isListening
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-stone-700'
                }`}
                style={{
                  height: isSpeaking || isListening ? undefined : `${h * 0.5}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* First-time listen button if user hasn't clicked yet */}
        {!hasStartedIntro && (
          <div className="mt-6 pt-5 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-stone-300">
              Avvia l'ascolto per sentire Silvia che si presenta e introduce il tema della puntata.
            </p>
            <button
              onClick={startIntroduction}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Volume2 className="w-4 h-4 fill-current" />
              <span>Ascolta Silvia (Incipit vocale)</span>
            </button>
          </div>
        )}
      </div>

      {/* Conversation Thread */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between text-xs text-stone-500 pb-3 mb-4 border-b border-stone-100">
          <span className="font-mono">DIscussione in Italiano</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSpeakReply}
                onChange={(e) => setAutoSpeakReply(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-700 rounded"
              />
              <span>Riproduci voce automaticamente</span>
            </label>
            <button
              onClick={() => stopSpeaking()}
              disabled={!isSpeaking}
              className="text-stone-400 hover:text-stone-700 disabled:opacity-30 cursor-pointer flex items-center gap-1"
              title="Ferma audio"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Silenzia</span>
            </button>
          </div>
        </div>

        {/* Message Log */}
        <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
          {messages.map((m) => {
            const isSilvia = m.role === 'silvia';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isSilvia ? 'items-start' : 'items-end'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1 text-xs text-stone-400 font-mono">
                  <span>{isSilvia ? 'Silvia da Firenze' : 'Tu'}</span>
                  <span>·</span>
                  <span className="tabular-nums">{m.timestamp}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isSilvia
                      ? 'bg-[#FAF8F5] text-stone-800 border border-stone-200/80 rounded-tl-sm'
                      : 'bg-stone-900 text-stone-100 rounded-tr-sm shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {isSilvia && (
                    <div className="mt-2.5 pt-2 border-t border-stone-200/50 flex items-center justify-between">
                      <button
                        onClick={() => playSpeech(m.text)}
                        className="text-xs text-amber-800 hover:text-amber-950 font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        title="Riascolta a voce"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Riascolta Silvia</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Interim speech recognition preview */}
          {isListening && interimTranscript && (
            <div className="flex flex-col items-end animate-pulse">
              <span className="text-xs text-stone-400 font-mono mb-1">Riconoscimento vocale...</span>
              <div className="max-w-[85%] rounded-2xl p-4 text-sm bg-stone-100 text-stone-600 border border-dashed border-stone-300">
                <p>«{interimTranscript}»</p>
              </div>
            </div>
          )}

          {/* Loading reply spinner */}
          {isLoadingReply && (
            <div className="flex items-center gap-2 text-stone-500 text-xs font-mono py-2">
              <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <span>Silvia sta formulando il suo pensiero...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Speech Error alert if mic blocked */}
        {speechError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2">
            <span>{speechError}</span>
            <button
              onClick={() => setSpeechError(null)}
              className="text-red-500 hover:text-red-800 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Suggested Prompts based on episode facts */}
        {analysis?.suggestedQuestions && analysis.suggestedQuestions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-100">
            <span className="text-xs font-mono uppercase tracking-wider text-stone-400 block mb-2">
              Spunti per la conversazione:
            </span>
            <div className="flex flex-wrap gap-2">
              {analysis.suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUserSend(q)}
                  className="text-xs bg-[#FAF8F5] hover:bg-stone-100 text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input / Control Dock */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Main Voice Microphone Button */}
          <button
            onClick={toggleListening}
            className={`h-12 px-5 rounded-xl font-medium text-xs flex items-center gap-2.5 transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-md'
                : 'bg-amber-800 hover:bg-amber-900 text-white shadow-xs'
            }`}
            title={isListening ? 'Interrompi ascolto' : 'Premi per parlare in italiano'}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Sto ascoltando...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Parla al microfono</span>
              </>
            )}
          </button>

          {/* Text input fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUserSend(inputText);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Oppure scrivi la tua opinione o domanda per Silvia in italiano..."
              className="flex-1 bg-[#FAF8F5] border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-600 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoadingReply}
              className="p-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 text-white rounded-xl transition-colors cursor-pointer shrink-0"
              title="Invia messaggio"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer Voice status info */}
        <div className="mt-3 pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-stone-400" />
            <span>
              {activeVoice ? `Voce rilevata: ${activeVoice.name} (it-IT)` : 'Voce sintetica italiana nativa'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono">COSMO Italiano WDR</span>
            <span>·</span>
            <span>Firenze / Monaco</span>
          </div>
        </div>
      </div>
    </div>
  );
};
