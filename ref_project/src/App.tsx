/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  AlertCircle,
  Radio,
  Clock,
  Send,
  RefreshCw,
  Compass,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Dices,
  Newspaper,
  BookOpen,
} from 'lucide-react';

import { DailyTopic, VoiceGender, CallFeedbackData, TopicCategoryId, TutorMemory, SessionHistoryItem } from './types';
import { CURATED_TOPICS, TOPIC_CATEGORIES, getRandomTopicForCategory, getRandomTopic } from './data/curatedTopics';
import { TopicSelectorModal } from './components/TopicSelectorModal';
import { MemoryModal } from './components/MemoryModal';
import {
  getStoredMemory,
  addSessionToHistory,
  getCompactMemoryForLive,
  recordDiscoveredPersonalData,
  recordDifficultyFeedback,
} from './services/memoryService';

const STORAGE_VOICE_KEY = 'maestro_italiano_voice_v1';
const STORAGE_TOPIC_KEY = 'maestro_italiano_topic_v1';
const STORAGE_CAT_KEY = 'maestro_italiano_cat_v1';

// Useful Spoken Phrases that the student can quickly trigger or speak
const QUICK_CONVERSATION_PHRASES = [
  'Ciao Andrea! Tutto bene, grazie. E tu?',
  'Sì, va benissimo questo argomento!',
  'Preferisco parlare di un altro argomento oggi.',
  'Puoi ripetere più lentamente?',
  'Come si dice questo in italiano?',
  'Cosa ne pensi tu, Andrea?',
];

export default function App() {
  // Tutor Memory (Permanent user profile + FIFO session history)
  const [memory, setMemory] = useState<TutorMemory>(() => getStoredMemory());
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isAnalyzingMemory, setIsAnalyzingMemory] = useState(false);
  const [lastSessionResult, setLastSessionResult] = useState<SessionHistoryItem | null>(null);
  const [learnedToast, setLearnedToast] = useState<string | null>(null);
  const [difficultySubmitted, setDifficultySubmitted] = useState<'difficile' | 'perfetto' | 'facile' | null>(null);

  const memoryRef = useRef(memory);
  memoryRef.current = memory;

  // Auto-dismiss learnedToast after 4 seconds
  useEffect(() => {
    if (learnedToast) {
      const timer = setTimeout(() => setLearnedToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [learnedToast]);

  // Voice selection (Maschile = Puck, Femminile = Kore)
  const [teacherVoice, setTeacherVoice] = useState<VoiceGender>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VOICE_KEY);
      if (saved === 'femminile' || saved === 'maschile') return saved;
    } catch (_) {}
    return 'maschile';
  });

  // Topic selection
  const [selectedTopic, setSelectedTopic] = useState<DailyTopic>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_TOPIC_KEY);
      const found = CURATED_TOPICS.find((t) => t.id === savedId);
      if (found) return found;
    } catch (_) {}
    return CURATED_TOPICS[0];
  });

  // Category selection (5 defined topic areas)
  const [selectedCategory, setSelectedCategory] = useState<TopicCategoryId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CAT_KEY) as TopicCategoryId;
      if (['cultura', 'geografia', 'notizie', 'giochi', 'grammatica'].includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return (selectedTopic.categoryId as TopicCategoryId) || 'cultura';
  });

  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

  // Call status: 'idle' | 'connecting' | 'active' | 'ended'
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isTeacherSpeaking, setIsTeacherSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customInputText, setCustomInputText] = useState('');
  const [callTranscriptSnippet, setCallTranscriptSnippet] = useState<string | null>(null);

  // Feedback states
  const [conversationSnippets, setConversationSnippets] = useState<string[]>([]);
  const [feedbackData, setFeedbackData] = useState<CallFeedbackData | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [showFeedbackCard, setShowFeedbackCard] = useState(false);

  // Audio References
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const callTimerRef = useRef<any>(null);
  const conversationSnippetsRef = useRef<string[]>([]);
  const callDurationRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const selectedTopicRef = useRef(selectedTopic);
  selectedTopicRef.current = selectedTopic;

  isMutedRef.current = isMuted;

  // Persist voice selection
  const handleVoiceChange = (gender: VoiceGender) => {
    setTeacherVoice(gender);
    try {
      localStorage.setItem(STORAGE_VOICE_KEY, gender);
    } catch (_) {}
  };

  // Persist topic selection
  const handleTopicChange = (topic: DailyTopic) => {
    setSelectedTopic(topic);
    if (callState === 'ended') {
      setCallState('idle');
    }
    if (topic.categoryId) {
      setSelectedCategory(topic.categoryId);
      try {
        localStorage.setItem(STORAGE_CAT_KEY, topic.categoryId);
      } catch (_) {}
    }
    try {
      localStorage.setItem(STORAGE_TOPIC_KEY, topic.id);
    } catch (_) {}
  };

  // Switch category and generate a new random topic for it
  const handleCategoryChange = async (catId: TopicCategoryId) => {
    setSelectedCategory(catId);
    if (callState === 'ended') {
      setCallState('idle');
    }
    try {
      localStorage.setItem(STORAGE_CAT_KEY, catId);
    } catch (_) {}
    await generateTopicForCategory(catId);
  };

  // Generate / pick dynamic random topic for a category
  const generateTopicForCategory = async (catId: TopicCategoryId) => {
    setIsGeneratingTopic(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catId, excludeTopicId: selectedTopic.id }),
      });
      if (res.ok) {
        const topic: DailyTopic = await res.json();
        handleTopicChange(topic);
      } else {
        const fallback = getRandomTopicForCategory(catId, selectedTopic.id);
        handleTopicChange(fallback);
      }
    } catch (err) {
      console.warn('API topic generation error, using fallback:', err);
      const fallback = getRandomTopicForCategory(catId, selectedTopic.id);
      handleTopicChange(fallback);
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  // Timer for active call
  useEffect(() => {
    if (callState === 'active') {
      setCallDuration(0);
      callDurationRef.current = 0;
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => {
          const next = prev + 1;
          callDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [callState]);

  // Convert Float32Array to 16-bit PCM base64
  const float32ToPcmBase64 = (float32Array: Float32Array): string => {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  };

  // Stop all actively queued audio chunks immediately (used on interruption or hang up)
  const stopAllAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsTeacherSpeaking(false);
  }, []);

  // Play incoming raw 24kHz PCM chunk from Gemini Live
  const playPcmChunk = useCallback((base64Audio: string) => {
    if (!outputCtxRef.current) return;
    const ctx = outputCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      setIsTeacherSpeaking(true);

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
        if (activeSourcesRef.current.length === 0) {
          setIsTeacherSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Error decoding/playing PCM audio:', err);
    }
  }, []);

  // End live call, clean up hardware resources and automatically extract & store session memory (FIFO)
  const endCall = useCallback(async () => {
    stopAllAudio();

    const wasActiveOrConnecting =
      callStateRef.current === 'active' || callStateRef.current === 'connecting';

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    setAudioLevel(0);

    // If call was NOT ongoing (e.g. user was idle or changing topics), do not switch to 'ended'
    if (!wasActiveOrConnecting) {
      return;
    }

    setCallState('ended');

    // Automatically analyze the completed session, extract permanent personal facts and store in FIFO history
    const finalSnippets = [...conversationSnippetsRef.current];
    const finalDuration = callDurationRef.current;
    const currentTopicObj = selectedTopicRef.current;
    const topicTitle = currentTopicObj.italianHeadline || currentTopicObj.title;

    // If aborted in less than 2 seconds with no text, skip analysis
    if (finalDuration < 2 && finalSnippets.length === 0) {
      return;
    }

    setIsAnalyzingMemory(true);
    try {
      const res = await fetch('/api/analyze-session-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicTitle,
          transcriptSnippets: finalSnippets,
          callDurationSeconds: finalDuration,
          currentProfile: memoryRef.current.userProfile,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const { memory: updatedMem, addedItem } = addSessionToHistory({
          topic: topicTitle,
          durationSeconds: finalDuration,
          summary: data.sessionSummary,
          keyPoints: data.keyPoints,
          discoveredName: data.discoveredName,
          newPersonalFacts: data.discoveredFacts,
        });
        setMemory(updatedMem);
        setLastSessionResult(addedItem);
      } else {
        const { memory: updatedMem, addedItem } = addSessionToHistory({
          topic: topicTitle,
          durationSeconds: finalDuration,
          summary: `Sessione su "${topicTitle}". Lo studente ha conversato per consolidare la propria scioltezza in italiano.`,
          keyPoints: [`Conversazione su ${topicTitle}`],
        });
        setMemory(updatedMem);
        setLastSessionResult(addedItem);
      }
    } catch (err) {
      console.warn('Error during session memory analysis:', err);
      const { memory: updatedMem, addedItem } = addSessionToHistory({
        topic: topicTitle,
        durationSeconds: finalDuration,
        summary: `Sessione su "${topicTitle}". Pratica di conversazione orale completata.`,
        keyPoints: [`Pratica su ${topicTitle}`],
      });
      setMemory(updatedMem);
      setLastSessionResult(addedItem);
    } finally {
      setIsAnalyzingMemory(false);
    }
  }, [stopAllAudio]);

  // Start live call session
  const startCall = async () => {
    try {
      setErrorMessage(null);
      setCallState('connecting');
      setCallTranscriptSnippet(null);
      setFeedbackData(null);
      setShowFeedbackCard(false);
      setConversationSnippets([]);
      conversationSnippetsRef.current = [];
      setLastSessionResult(null);
      setDifficultySubmitted(null);

      // 1. Setup AudioContexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      // 2. Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      // 3. Connect to WebSocket Live endpoint with chosen voice, topic, category context & student memory
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const voiceParam = teacherVoice === 'femminile' ? 'Kore' : 'Puck';
      const topicParam = encodeURIComponent(selectedTopic.italianHeadline || selectedTopic.title);
      const catParam = encodeURIComponent(selectedTopic.categoryId || selectedCategory || 'cultura');
      const starterParam = encodeURIComponent(selectedTopic.starterPrompt || '');
      const gameTypeParam = encodeURIComponent(selectedTopic.gameType || '');
      const grammarFocusParam = encodeURIComponent(selectedTopic.grammarFocus || '');
      const gameRulesParam = encodeURIComponent(selectedTopic.gameRules || '');

      // Encode memory for the tutor to review on session start
      const compactMemory = getCompactMemoryForLive(memoryRef.current);
      const memoryParam = encodeURIComponent(JSON.stringify(compactMemory));

      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${voiceParam}&topic=${topicParam}&category=${catParam}&starter=${starterParam}&gameType=${gameTypeParam}&grammarFocus=${grammarFocusParam}&gameRules=${gameRulesParam}&memory=${memoryParam}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setCallState('active');
        // Also send initial memory handshake over socket
        try {
          ws.send(JSON.stringify({ type: 'init_memory', memory: compactMemory }));
        } catch (_) {}
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            setCallState('active');
          } else if (data.type === 'audio' && data.audio) {
            playPcmChunk(data.audio);
            if (data.text) {
              setCallTranscriptSnippet(data.text);
              setConversationSnippets((prev) => {
                const next = [...prev.slice(-30), `Andrea: ${data.text}`];
                conversationSnippetsRef.current = next;
                return next;
              });
            }
          } else if (data.type === 'user_transcript' && data.text) {
            setConversationSnippets((prev) => {
              const next = [...prev.slice(-30), `Studente: ${data.text}`];
              conversationSnippetsRef.current = next;
              return next;
            });
          } else if (data.type === 'model_transcript' && data.text) {
            setCallTranscriptSnippet(data.text);
            setConversationSnippets((prev) => {
              const next = [...prev.slice(-30), `Andrea: ${data.text}`];
              conversationSnippetsRef.current = next;
              return next;
            });
          } else if (data.type === 'personal_fact_discovered') {
            const { memory: updated } = recordDiscoveredPersonalData(data.name, data.facts);
            setMemory(updated);
            memoryRef.current = updated;
            if (data.name) {
              setLearnedToast(`🧠 Andrea ha memorizzato: Nome = ${data.name}`);
            } else if (data.facts && data.facts.length > 0) {
              const first = data.facts[0];
              setLearnedToast(`🧠 Andrea ha memorizzato: ${first.label} = ${first.value}`);
            }
          } else if (data.type === 'interrupted') {
            stopAllAudio();
          } else if (data.type === 'error') {
            setErrorMessage(data.message || 'Errore nella sessione Live');
            endCall();
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setErrorMessage('Connessione WebSocket non riuscita. Riprova tra poco.');
        endCall();
      };

      ws.onclose = () => {
        setCallState((current) => (current === 'active' ? 'ended' : current));
      };

      // 4. Hook microphone ScriptProcessor to stream PCM audio to Gemini Live
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);

        // Real-time RMS volume computation
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(100, Math.round(rms * 450));
        setAudioLevel(level);

        if (ws.readyState === WebSocket.OPEN) {
          const base64Pcm = float32ToPcmBase64(inputData);
          ws.send(JSON.stringify({ audio: base64Pcm }));
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

      // 5. In-browser real-time speech transcription to capture student phrases for memory
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = 'it-IT';
          rec.continuous = true;
          rec.interimResults = false;
          rec.onresult = (e: any) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              if (e.results[i].isFinal) {
                const phrase = e.results[i][0]?.transcript?.trim();
                if (phrase) {
                  setConversationSnippets((prev) => {
                    const next = [...prev.slice(-30), `Studente: ${phrase}`];
                    conversationSnippetsRef.current = next;
                    return next;
                  });
                }
              }
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch (speechErr) {
          console.warn('SpeechRecognition init skipped:', speechErr);
        }
      }
    } catch (err: any) {
      console.error('Call initialization error:', err);
      setCallState('idle');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Accesso al microfono negato. Concedi l\'autorizzazione al microfono nel browser.');
      } else {
        setErrorMessage('Impossibile accedere al microfono o avviare la chiamata. Verifica i dispositivi audio.');
      }
    }
  };

  // Send a custom text prompt or phrase into the ongoing call
  const sendTextPrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    setConversationSnippets((prev) => {
      const next = [...prev.slice(-30), `Studente: ${trimmed}`];
      conversationSnippetsRef.current = next;
      return next;
    });
    setCustomInputText('');
  };

  // Request feedback from Andrea (spoken via Live voice + structured card in UI)
  const handleRequestFeedback = async () => {
    if (isFeedbackLoading) return;
    setIsFeedbackLoading(true);
    setShowFeedbackCard(true);

    // 1. Send feedback trigger to Andrea via WebSocket so Andrea speaks the feedback in Italian
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'request_feedback',
          text: 'Andrea, per favore dammi adesso il tuo feedback vocale sulla nostra conversazione! Ricorda le regole: evidenzia al massimo 2 errori gravi se presenti, altrimenti fammi semplicemente un caloroso complimento; poi cita in pochissime parole 2-3 vocaboli o frasi chiave della conversazione. Infine resta disponibile e non chiudere la telefonata, così posso farti altre domande o continuare a parlare se voglio.',
        })
      );
    }

    // 2. Fetch structured textual summary for UI display
    try {
      const res = await fetch('/api/call-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic.italianHeadline,
          transcriptSnippets: conversationSnippets,
          callDurationSeconds: callDuration,
          currentScore: memoryRef.current.userProfile.proficiency?.score ?? null,
        }),
      });
      if (res.ok) {
        const data: CallFeedbackData = await res.json();
        setFeedbackData(data);
      }
    } catch (err) {
      console.warn('Error fetching textual call feedback:', err);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  // Submit user difficulty feedback (Troppo difficile / Perfetto / Troppo facile)
  const handleDifficultyFeedback = (choice: 'difficile' | 'perfetto' | 'facile') => {
    setDifficultySubmitted(choice);
    const aiScore = feedbackData?.estimatedProficiencyScore;
    const result = recordDifficultyFeedback(choice, aiScore);
    setMemory(result.memory);
    memoryRef.current = result.memory;
    setLearnedToast(`📈 Livello aggiornato: ${result.newScore}/100 (${result.stageLabel})`);
  };

  // Format seconds to MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endCallRef = useRef(endCall);
  endCallRef.current = endCall;

  // Clean up on component unmount only
  useEffect(() => {
    return () => {
      endCallRef.current();
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between selection:bg-amber-500/30">
      {/* Top Header */}
      <header className="border-b border-stone-800/80 bg-stone-900/60 backdrop-blur-md px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-amber-900/20">
              🇮🇹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif-italian text-lg sm:text-xl font-bold tracking-tight text-white">
                  Andrea
                </h1>
                <button
                  onClick={() => setIsMemoryModalOpen(true)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1 cursor-pointer"
                  title="Livello linguistico adattivo e controllo ritmo: clicca per aprire il profilo"
                >
                  {memory.userProfile.proficiency?.score !== null && memory.userProfile.proficiency?.score !== undefined ? (
                    <>
                      <span className="font-mono tabular-nums">{memory.userProfile.proficiency.score}/100</span>
                      <span className="text-amber-500">·</span>
                      <span>{memory.userProfile.proficiency.stageLabel}</span>
                      {memory.userProfile.proficiency.score <= 35 && (
                        <>
                          <span className="text-amber-500">·</span>
                          <span className="text-amber-200">Ritmo Lento</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>🌱 In calibrazione</span>
                  )}
                </button>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Conversazione audio in tempo reale con intelligenza artificiale madrelingua
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Topic Pill / Modal trigger */}
            <button
              onClick={() => setIsTopicModalOpen(true)}
              disabled={callState === 'active' || callState === 'connecting'}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-800 border border-stone-700/80 text-xs text-amber-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Cambia area tematica o argomento"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate max-w-[140px] text-stone-200">
                {selectedTopic.title}
              </span>
            </button>

            {/* Memory & Profile Button */}
            <button
              onClick={() => setIsMemoryModalOpen(true)}
              disabled={callState === 'active' || callState === 'connecting'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-800 border border-stone-700/80 text-xs text-stone-200 hover:text-amber-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Visualizza e gestisci la memoria del tutor (dati personali e storico sessioni)"
            >
              <span className="text-sm">🧠</span>
              <span className="font-semibold text-amber-300 hidden sm:inline">
                {memory.userProfile.name ? memory.userProfile.name : 'Memoria'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-700 text-stone-300 font-mono">
                {memory.sessionHistory.length}
              </span>
            </button>

            {/* Teacher Voice Toggle (Maschile / Femminile) */}
            <div className="flex items-center rounded-xl bg-stone-800/90 p-1 border border-stone-700/80 shadow-xs">
              <button
                onClick={() => handleVoiceChange('maschile')}
                disabled={callState === 'active' || callState === 'connecting'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  teacherVoice === 'maschile'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200 disabled:opacity-50'
                }`}
                title="Voce maschile: Andrea (Puck)"
              >
                <span>👨</span>
                <span className="hidden sm:inline">Uomo</span>
              </button>
              <button
                onClick={() => handleVoiceChange('femminile')}
                disabled={callState === 'active' || callState === 'connecting'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  teacherVoice === 'femminile'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-200 disabled:opacity-50'
                }`}
                title="Voce femminile: Andrea (Kore)"
              >
                <span>👩</span>
                <span className="hidden sm:inline">Donna</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Call View */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-start gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Attenzione</p>
              <p className="text-xs text-rose-300 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-400 hover:text-rose-200 underline shrink-0"
            >
              Chiudi
            </button>
          </div>
        )}

        {/* ACTIVE OR CONNECTING CALL VIEW */}
        {(callState === 'active' || callState === 'connecting') && (
          <div className="w-full bg-stone-900/90 border border-stone-800 rounded-3xl p-6 sm:p-10 text-white shadow-2xl relative flex flex-col items-center text-center">
            {/* Real-time memory toast banner */}
            {learnedToast && (
              <div className="w-full mb-4 px-4 py-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-semibold shadow-xl flex items-center justify-center gap-2 animate-bounce">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{learnedToast}</span>
              </div>
            )}

            {/* Live Status Badge & Timer */}
            <div className="flex items-center justify-between w-full mb-6">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-xs font-medium text-emerald-300">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Chiamata Live In Corso</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatTimer(callDuration)}</span>
              </div>
            </div>

            {/* Central Animated Speaking Visualizer */}
            <div className="relative my-6">
              {/* Outer pulsing ring for teacher speaking */}
              <div
                className={`absolute -inset-6 rounded-full transition-all duration-300 ${
                  isTeacherSpeaking
                    ? 'bg-amber-500/25 scale-125 animate-ping'
                    : audioLevel > 15
                    ? 'bg-emerald-500/25 scale-110 animate-pulse'
                    : 'bg-transparent'
                }`}
              />

              {/* Secondary audio aura */}
              <div
                className={`absolute -inset-3 rounded-full transition-all duration-200 ${
                  isTeacherSpeaking
                    ? 'bg-amber-400/20 ring-4 ring-amber-400/30'
                    : audioLevel > 15
                    ? 'bg-emerald-400/20 ring-4 ring-emerald-400/30'
                    : 'bg-stone-800/40'
                }`}
              />

              {/* Avatar circle */}
              <div
                className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-5xl sm:text-6xl shadow-2xl transition-all duration-300 ${
                  isTeacherSpeaking
                    ? 'bg-gradient-to-tr from-amber-600 to-amber-400 ring-4 ring-amber-300 scale-105 shadow-amber-500/40'
                    : audioLevel > 15
                    ? 'bg-stone-800 ring-4 ring-emerald-400 shadow-emerald-500/30'
                    : 'bg-stone-800 border-2 border-stone-700'
                }`}
              >
                {teacherVoice === 'femminile' ? '👩‍🏫' : '👨‍🏫'}
              </div>
            </div>

            {/* Teacher Name & Current Topic */}
            <h2 className="font-serif-italian text-2xl sm:text-3xl font-bold tracking-tight text-white mt-2">
              Andrea
            </h2>
            <p className="text-xs sm:text-sm text-amber-300 font-medium mt-1 max-w-md line-clamp-1">
              Spunto iniziale: {selectedTopic.italianHeadline}
            </p>

            {/* Adaptive Level & Speaking Pace Indicator */}
            {memory.userProfile.proficiency?.score !== null && memory.userProfile.proficiency?.score !== undefined ? (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-stone-800/90 border border-stone-700 text-[11px] text-stone-300">
                <span className="font-mono font-bold text-amber-400">{memory.userProfile.proficiency.score}/100</span>
                <span className="text-stone-500">·</span>
                <span className="text-stone-200">{memory.userProfile.proficiency.stageLabel}</span>
                <span className="text-stone-500">·</span>
                <span className="text-amber-300 font-medium">
                  🎙️ {memory.userProfile.proficiency.speechPaceLabel || (memory.userProfile.proficiency.score <= 35 ? 'Ritmo Lento & Scandito' : 'Ritmo Naturale')}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-stone-800/90 border border-stone-700 text-[11px] text-stone-400">
                <span>🌱 Calibrazione aperta · Ritmo calmo</span>
              </div>
            )}

            {/* Live State Description */}
            <div className="h-10 flex items-center justify-center my-3">
              {callState === 'connecting' && (
                <span className="text-xs text-stone-400 flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  Connessione vocale bidirezionale a Gemini Live in corso...
                </span>
              )}
              {callState === 'active' && isTeacherSpeaking && (
                <span className="text-xs sm:text-sm text-amber-400 font-medium flex items-center gap-2 animate-pulse">
                  <Volume2 className="w-4 h-4" /> Andrea sta parlando in italiano...
                </span>
              )}
              {callState === 'active' && !isTeacherSpeaking && (
                <span className="text-xs sm:text-sm text-emerald-400 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Ti ascolto! Parla pure...
                </span>
              )}
            </div>

            {/* Audio Wave Visualizer Bars */}
            <div className="flex items-center justify-center gap-2 h-7 my-2">
              {[0.4, 0.8, 1.0, 0.7, 0.5, 0.9, 0.6].map((mult, idx) => {
                const heightClass = isTeacherSpeaking
                  ? 'h-6 bg-amber-400'
                  : audioLevel > 15
                  ? 'h-5 bg-emerald-400'
                  : 'h-1.5 bg-stone-700';
                return (
                  <span
                    key={idx}
                    style={{ transform: `scaleY(${isTeacherSpeaking ? mult : 1})` }}
                    className={`w-1.5 sm:w-2 rounded-full transition-all duration-150 ${heightClass}`}
                  />
                );
              })}
            </div>

            {/* Subtitle / Live Transcript Card if text exists */}
            {callTranscriptSnippet && (
              <div className="w-full max-w-lg mt-3 p-3 rounded-2xl bg-stone-800/60 border border-stone-700/60 text-xs sm:text-sm text-stone-300 text-center italic animate-fadeIn">
                "{callTranscriptSnippet}"
              </div>
            )}

            {/* Quick Spoken Phrase Aids */}
            <div className="w-full max-w-lg mt-6">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Frasi veloci per la conversazione
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {QUICK_CONVERSATION_PHRASES.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendTextPrompt(phrase)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50 text-stone-300 hover:text-white transition-all active:scale-95"
                    title={`Invia ad Andrea: "${phrase}"`}
                  >
                    💬 {phrase}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Text Prompt Input in Call */}
            <div className="w-full max-w-lg mt-4 flex items-center gap-2">
              <input
                type="text"
                value={customInputText}
                onChange={(e) => setCustomInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendTextPrompt(customInputText);
                }}
                placeholder="Scrivi qualcosa se preferisci digitare..."
                className="flex-1 bg-stone-800/80 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-hidden focus:border-amber-400"
              />
              <button
                onClick={() => sendTextPrompt(customInputText)}
                disabled={!customInputText.trim()}
                className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors"
                title="Invia testo ad Andrea"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Call Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-7">
              {/* Mute Button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3.5 sm:p-4 rounded-full transition-all shadow-lg active:scale-95 flex items-center justify-center cursor-pointer ${
                  isMuted
                    ? 'bg-rose-900/60 text-rose-300 border border-rose-700 hover:bg-rose-900'
                    : 'bg-stone-800 text-emerald-400 border border-stone-700 hover:bg-stone-700'
                }`}
                title={isMuted ? 'Riattiva microfono' : 'Disattiva microfono'}
              >
                {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              {/* Feedback Button (Sole trigger for feedback) */}
              <button
                onClick={handleRequestFeedback}
                disabled={isFeedbackLoading}
                className="px-5 sm:px-7 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold flex items-center gap-2 shadow-xl shadow-amber-950/60 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                title="Richiedi feedback: lode, max 2 errori, vocaboli chiave (la chiamata non si chiude)"
              >
                {isFeedbackLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-stone-950" />
                    <span className="text-xs sm:text-base">Ascolto Feedback...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950 fill-stone-950" />
                    <span className="text-xs sm:text-base">Feedback</span>
                  </>
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={endCall}
                className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2 sm:gap-2.5 shadow-xl shadow-rose-900/60 active:scale-95 transition-all cursor-pointer"
                title="Termina la telefonata live"
              >
                <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs sm:text-base">Termina Chiamata</span>
              </button>
            </div>

            {/* In-Call Textual Feedback Card */}
            {showFeedbackCard && (
              <div className="w-full max-w-xl mt-6 p-4 sm:p-6 rounded-3xl bg-stone-900/95 border border-amber-500/40 text-left shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                      ✨
                    </div>
                    <div>
                      <h3 className="font-serif-italian text-sm sm:text-base font-bold text-white leading-tight">
                        Feedback di Andrea
                      </h3>
                      <span className="text-[10px] sm:text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Chiamata ancora aperta: Andrea è in linea con te!
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFeedbackCard(false)}
                    className="text-[11px] text-stone-400 hover:text-stone-200 px-2.5 py-1 rounded-lg bg-stone-800 border border-stone-700 cursor-pointer"
                  >
                    Nascondi
                  </button>
                </div>

                {isFeedbackLoading && !feedbackData ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400 mb-2" />
                    <p className="text-xs text-stone-400">
                      Andrea sta parlando a voce ed elaborando il feedback scritto...
                    </p>
                  </div>
                ) : feedbackData ? (
                  <div className="space-y-3.5 pt-3 text-xs sm:text-sm">
                    {/* Praise */}
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                      <p className="font-semibold text-amber-300 text-[11px] uppercase tracking-wider mb-0.5">
                        Valutazione & Lode
                      </p>
                      <p className="leading-relaxed text-xs sm:text-sm">{feedbackData.praise}</p>
                    </div>

                    {/* Major Errors (max 2) */}
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                        Punti da migliorare (massimo 2)
                      </span>
                      {feedbackData.errors && feedbackData.errors.length > 0 ? (
                        <div className="space-y-2">
                          {feedbackData.errors.map((err, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-2xl bg-stone-800/80 border border-stone-700 text-xs"
                            >
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="line-through text-rose-400 font-medium">
                                  "{err.original}"
                                </span>
                                <span className="text-stone-500">➔</span>
                                <span className="text-emerald-400 font-bold">
                                  "{err.correction}"
                                </span>
                              </div>
                              <p className="text-stone-300 text-[11px] leading-relaxed">
                                {err.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Nessun errore grossolano! Ottima padronanza e scioltezza comunicativa.</span>
                        </div>
                      )}
                    </div>

                    {/* Vocabulary & Key phrases (compact) */}
                    {feedbackData.vocabularyAndPhrases && feedbackData.vocabularyAndPhrases.length > 0 && (
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                          Vocaboli & Frasi Chiave (in sintesi)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {feedbackData.vocabularyAndPhrases.map((v, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs"
                            >
                              <p className="font-bold text-amber-300">{v.phrase}</p>
                              <p className="text-[11px] text-stone-400 mt-0.5">{v.meaning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Grammar Tip */}
                    {feedbackData.grammarTip && (
                      <div className="p-2.5 rounded-xl bg-stone-800/40 border border-stone-700/40 text-xs text-stone-300 flex items-start gap-2">
                        <span className="text-amber-400 shrink-0 font-bold">💡 Grammatica:</span>
                        <p className="text-[11px] text-stone-300 leading-relaxed">{feedbackData.grammarTip}</p>
                      </div>
                    )}

                    {/* Note about discussing or continuing */}
                    <div className="text-[11px] text-stone-400 text-center pt-1.5 border-t border-stone-800/60 italic">
                      🗣️ Vuoi chiarimenti su questo feedback o continuare la conversazione? Parla pure, Andrea è ancora in ascolto!
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <p className="text-[11px] text-stone-500 mt-6">
              Gemini 3.8 Live API • Audio duplex a 16kHz/24kHz senza latenza
            </p>
          </div>
        )}

        {/* POST-CALL SUMMARY VIEW */}
        {callState === 'ended' && (
          <div className="w-full bg-stone-900/90 border border-stone-800 rounded-3xl p-6 sm:p-10 text-white shadow-2xl text-center flex flex-col items-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="font-serif-italian text-2xl sm:text-3xl font-bold">
              Chiamata Conclusa
            </h2>
            <p className="text-sm text-stone-400 mt-1">
              Ottimo lavoro! Parlare a voce è il modo più efficace per progredire in scioltezza e sicurezza.
            </p>

            {/* Call Metrics */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm my-6">
              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 text-center">
                <span className="text-xs text-stone-400 block">Durata Chiamata</span>
                <span className="text-xl font-mono font-bold text-amber-400">
                  {formatTimer(callDuration)}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700/80 text-center">
                <span className="text-xs text-stone-400 block">Insegnante</span>
                <span className="text-sm font-semibold text-white mt-1 block">
                  Andrea ({teacherVoice === 'femminile' ? 'Donna' : 'Uomo'})
                </span>
              </div>
            </div>

            {/* Post-Lesson Difficulty Feedback Card */}
            <div className="w-full max-w-md my-2 p-5 rounded-2xl bg-gradient-to-br from-stone-800/95 to-stone-900 border border-amber-500/30 text-left space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <h3 className="text-sm font-bold text-white">Com'è stata questa lezione?</h3>
                </div>
                <span className="text-[10px] text-amber-300 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  Calibrazione Livello
                </span>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                Aiuta Andrea ad adattare il ritmo, il vocabolario e la complessità della prossima telefonata:
              </p>

              {difficultySubmitted ? (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Riscontro registrato:{' '}
                      <strong className="text-white">
                        {difficultySubmitted === 'difficile' && 'Troppo difficile'}
                        {difficultySubmitted === 'perfetto' && 'Perfetto (Giusto così)'}
                        {difficultySubmitted === 'facile' && 'Troppo facile'}
                      </strong>
                    </span>
                  </div>
                  {typeof memory.userProfile.proficiency?.score === 'number' && (
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {memory.userProfile.proficiency.score}/100
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleDifficultyFeedback('difficile')}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800 hover:bg-stone-700/80 border border-stone-700 hover:border-rose-500/50 text-stone-200 transition-all active:scale-95 cursor-pointer group"
                    title="La lezione è stata troppo difficile: Andrea parlerà più lentamente e con parole più semplici"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🔴</span>
                    <span className="text-xs font-semibold text-white">Troppo</span>
                    <span className="text-[11px] text-stone-400">difficile</span>
                  </button>

                  <button
                    onClick={() => handleDifficultyFeedback('perfetto')}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 hover:border-amber-400 text-amber-200 transition-all active:scale-95 cursor-pointer shadow-sm group"
                    title="La lezione è stata adatta al tuo livello attuale"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🎯</span>
                    <span className="text-xs font-bold text-white">Perfetto</span>
                    <span className="text-[11px] text-amber-300/80">Giusto così</span>
                  </button>

                  <button
                    onClick={() => handleDifficultyFeedback('facile')}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-stone-800 hover:bg-stone-700/80 border border-stone-700 hover:border-sky-500/50 text-stone-200 transition-all active:scale-95 cursor-pointer group"
                    title="La lezione è stata troppo facile: Andrea aumenterà la complessità del dialogo"
                  >
                    <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🔵</span>
                    <span className="text-xs font-semibold text-white">Troppo</span>
                    <span className="text-[11px] text-stone-400">facile</span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800/80">
                <span>Livello stimato:</span>
                <span className="font-semibold text-amber-300">
                  {memory.userProfile.proficiency?.score !== null && memory.userProfile.proficiency?.score !== undefined ? (
                    <>
                      <span className="font-mono tabular-nums">{memory.userProfile.proficiency.score}/100</span> · {memory.userProfile.proficiency.stageLabel}
                    </>
                  ) : (
                    '🌱 In calibrazione'
                  )}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-800/40 border border-stone-800 text-left w-full max-w-md mb-5">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                Tema trattato
              </span>
              <p className="text-sm font-medium text-amber-200 mt-0.5">
                {selectedTopic.italianHeadline}
              </p>
            </div>

            {/* Feedback section in post-call summary */}
            {feedbackData ? (
              <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-stone-800/80 border border-amber-500/30 text-left">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-stone-700/80">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                    Feedback Finale di Andrea
                  </span>
                </div>
                <p className="text-xs text-amber-200 mb-3">{feedbackData.praise}</p>
                {feedbackData.errors && feedbackData.errors.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">
                      Punti di miglioramento (max 2):
                    </span>
                    {feedbackData.errors.map((e, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-stone-900/80 text-[11px]">
                        <span className="line-through text-rose-300">"{e.original}"</span> ➔{' '}
                        <span className="text-emerald-300 font-bold">"{e.correction}"</span>
                        <p className="text-stone-400 mt-0.5">{e.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
                {feedbackData.vocabularyAndPhrases && feedbackData.vocabularyAndPhrases.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">
                      Vocaboli & Frasi chiave:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {feedbackData.vocabularyAndPhrases.map((v, idx) => (
                        <div key={idx} className="p-1.5 rounded-lg bg-stone-900/60 text-[11px]">
                          <span className="font-bold text-amber-300">{v.phrase}</span>: {v.meaning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {feedbackData.grammarTip && (
                  <p className="text-[11px] text-stone-300 pt-1 border-t border-stone-700/60">
                    💡 <span className="font-semibold text-amber-400">Grammatica:</span> {feedbackData.grammarTip}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-6">
                <button
                  onClick={handleRequestFeedback}
                  disabled={isFeedbackLoading}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isFeedbackLoading ? 'Elaborazione...' : 'Mostra Feedback della Chiamata'}</span>
                </button>
              </div>
            )}

            {/* Automatic Session Memory & FIFO History card */}
            <div className="w-full max-w-md mb-6 p-4 rounded-2xl bg-stone-800/90 border border-amber-500/40 text-left shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-700/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧠</span>
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-300 block">
                      Memoria di Andrea
                    </span>
                    <span className="text-[10px] text-stone-400">
                      Sintesi salvata internamente nella cronologia (FIFO)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMemoryModalOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                >
                  Vedi Archivio ({memory.sessionHistory.length}) →
                </button>
              </div>

              {isAnalyzingMemory ? (
                <div className="py-4 flex flex-col items-center justify-center text-center space-y-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <p className="text-xs text-stone-300">
                    Andrea sta memorizzando la sintesi della sessione...
                  </p>
                </div>
              ) : lastSessionResult ? (
                <div className="space-y-2.5 text-xs">
                  <p className="text-amber-200 leading-relaxed font-medium">
                    "{lastSessionResult.summary}"
                  </p>

                  {lastSessionResult.keyPoints && lastSessionResult.keyPoints.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {lastSessionResult.keyPoints.map((pt, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-stone-900 border border-stone-700 text-stone-300"
                        >
                          • {pt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Discovered Personal Facts */}
                  {lastSessionResult.newPersonalFacts && lastSessionResult.newPersonalFacts.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-[11px] text-emerald-300">
                      <span className="font-bold flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        Nuovi dati personali memorizzati permanentemente:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {lastSessionResult.newPersonalFacts.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-emerald-900/60 border border-emerald-700/60 font-semibold"
                          >
                            {f.label}: {f.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between text-[10px] text-stone-400">
                    <span>💾 Rotazione FIFO (max {memory.maxSessions} sessioni memorizzate)</span>
                    <button
                      onClick={() => setIsMemoryModalOpen(true)}
                      className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                    >
                      Gestisci Profilo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-300 py-1">
                  Sessione archiviata. Andrea la consulterà prima della prossima telefonata.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={startCall}
                className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>Ricomincia Chiamata</span>
              </button>
              <button
                onClick={() => setCallState('idle')}
                className="px-6 py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold flex items-center gap-2 border border-stone-700 active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Scegli Altro Argomento</span>
              </button>
            </div>
          </div>
        )}

        {/* IDLE / READY TO CALL VIEW */}
        {callState === 'idle' && (
          <div className="w-full flex flex-col items-center">
            {/* Hero Teacher Presentation Card */}
            <div className="w-full bg-gradient-to-b from-stone-900/90 to-stone-900/50 border border-stone-800 rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center shadow-xl relative overflow-hidden">
              {/* Subtle Italian Tricolor Glow Accent */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-stone-200 to-rose-600 opacity-80" />

              {/* Large Avatar */}
              <div className="relative my-2">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-400 p-1 shadow-2xl shadow-amber-900/30">
                  <div className="w-full h-full rounded-full bg-stone-900 flex items-center justify-center text-5xl sm:text-6xl">
                    {teacherVoice === 'femminile' ? '👩‍🏫' : '👨‍🏫'}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold border-2 border-stone-900 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Online
                </div>
              </div>

              <h2 className="font-serif-italian text-2xl sm:text-3xl font-bold text-white mt-3">
                {memory.userProfile.name
                  ? `Pronto per parlare, ${memory.userProfile.name}?`
                  : 'Pronto per parlare in italiano?'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-400 max-w-lg mt-1">
                Fai una vera telefonata vocale con <span className="text-amber-400 font-medium">Andrea</span>. Chiacchierata naturale, risposte brevi e rilassate: il tema serve solo per rompere il ghiaccio, puoi parlare liberamente di qualsiasi cosa!
              </p>

              {/* Memory continuity indicator pill */}
              <div className="mt-3 flex items-center justify-center">
                <button
                  onClick={() => setIsMemoryModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-800/90 hover:bg-stone-800 border border-amber-500/30 text-amber-300 text-xs transition-colors cursor-pointer group"
                  title="Apri memoria di Andrea"
                >
                  <span>🧠</span>
                  {memory.userProfile.name ? (
                    <span>
                      Andrea ti conosce come <strong className="text-white">{memory.userProfile.name}</strong> •{' '}
                      {memory.sessionHistory.length > 0
                        ? `${memory.sessionHistory.length} sessioni nello storico`
                        : 'Prima sessione'}
                    </span>
                  ) : (
                    <span>
                      {memory.sessionHistory.length > 0
                        ? `${memory.sessionHistory.length} sessioni memorizzate (FIFO)`
                        : 'Memoria attiva: Andrea ricorda chi sei e le sessioni'}
                    </span>
                  )}
                  <span className="text-stone-400 group-hover:text-amber-300 transition-colors">→</span>
                </button>
              </div>

              {/* Big Prominent Call Button */}
              <button
                onClick={startCall}
                className="mt-6 px-10 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-base sm:text-lg font-bold flex items-center gap-3 shadow-xl shadow-emerald-950/80 hover:shadow-emerald-900/90 active:scale-95 transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <span>Avvia Chiamata Live</span>
              </button>

              {/* Highlights pills */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-[11px] text-stone-400">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/60">
                  ⚡ Latenza ultra-bassa
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/60">
                  🎙️ Parla liberamente
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/60">
                  🗣️ Interrompibile in ogni istante
                </span>
              </div>
            </div>

            {/* Topic Selection Section */}
            <div className="w-full mt-6 text-left">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Area tematica & Spunto di partenza
                  </h3>
                </div>
                <span className="text-xs text-stone-400">
                  Punto di partenza per la conversazione
                </span>
              </div>

              {/* 5 Defined Topic Areas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
                {TOPIC_CATEGORIES.map((cat) => {
                  const isCurrent = (selectedTopic.categoryId || selectedCategory) === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      disabled={isGeneratingTopic}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between group ${
                        isCurrent
                          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 text-white shadow-lg'
                          : 'bg-stone-900/60 hover:bg-stone-850 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider">
                            Attivo
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                          {cat.title || cat.titleIt}
                        </h4>
                        <p className="text-[10px] text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                          {cat.description || cat.descriptionIt}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Topic Spotlight Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-stone-900/95 via-stone-900/90 to-stone-950/90 border border-amber-500/40 mb-4 shadow-xl relative overflow-hidden">
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                {isGeneratingTopic ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                    <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
                    <p className="text-sm font-semibold text-white">
                      {selectedCategory === 'notizie'
                        ? '🔍 Ricerca delle notizie del giorno in Italia ed Europa...'
                        : selectedCategory === 'giochi'
                        ? '🎲 Ideazione del gioco linguistico interattivo...'
                        : selectedCategory === 'grammatica'
                        ? '✍️ Preparazione dell\'esercizio orale di grammatica...'
                        : '✨ Selezione di un argomento stimolante...'}
                    </p>
                    <p className="text-xs text-stone-400">
                      Andrea sta preparando l'argomento ideale per la tua conversazione...
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Top Row: Category Tag, Badges & Re-roll Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <span>{TOPIC_CATEGORIES.find(c => c.id === (selectedTopic.categoryId || selectedCategory))?.icon || '🇮🇹'}</span>
                          <span>{selectedTopic.category}</span>
                        </span>

                        {selectedTopic.isNewsResearched && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-700/80 flex items-center gap-1">
                            <span>🔍</span>
                            <span>Notizia in tempo reale</span>
                          </span>
                        )}

                        {selectedTopic.gameType && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-violet-950/80 text-violet-300 border border-violet-700/80 flex items-center gap-1">
                            <span>🎲</span>
                            <span>Gioco: {selectedTopic.gameType}</span>
                          </span>
                        )}

                        {selectedTopic.grammarFocus && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700/80 flex items-center gap-1">
                            <span>💡</span>
                            <span>Grammatica: {selectedTopic.grammarFocus}</span>
                          </span>
                        )}
                      </div>

                      {/* Randomize / New topic button */}
                      <button
                        onClick={() => generateTopicForCategory(selectedTopic.categoryId || selectedCategory)}
                        disabled={isGeneratingTopic}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Estrai casualmente un altro argomento per questa categoria"
                      >
                        <Dices className="w-3.5 h-3.5 text-amber-400" />
                        <span>Estrai un altro tema</span>
                      </button>
                    </div>

                    {/* Headline and Topic Content */}
                    <h4 className="font-serif-italian text-lg sm:text-xl font-bold text-white mt-1 leading-snug">
                      "{selectedTopic.italianHeadline}"
                    </h4>
                    <p className="text-xs sm:text-sm text-stone-300 mt-1.5 font-medium">
                      {selectedTopic.title} • {selectedTopic.description}
                    </p>

                    {/* Game Rules callout if applicable */}
                    {selectedTopic.gameRules && (
                      <div className="mt-3 p-3 rounded-2xl bg-stone-950/60 border border-violet-500/30 text-xs text-violet-200 flex items-start gap-2">
                        <span className="font-bold text-violet-400 shrink-0">🎮 Dinamica del gioco:</span>
                        <p className="text-[11px] text-stone-300 leading-relaxed">{selectedTopic.gameRules}</p>
                      </div>
                    )}

                    {/* Grammar details callout if applicable */}
                    {selectedTopic.grammarFocus && (
                      <div className="mt-3 p-3 rounded-2xl bg-stone-950/60 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                        <span className="font-bold text-rose-400 shrink-0">✍️ Obiettivo linguistico:</span>
                        <p className="text-[11px] text-stone-300 leading-relaxed">{selectedTopic.grammarFocus}</p>
                      </div>
                    )}

                    {/* Pedagogical Note */}
                    <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px] text-amber-300/90 font-medium">
                      <span>
                        💡 <strong className="text-amber-200">Importante:</strong> L'argomento è solo uno spunto iniziale. Durante la conversazione puoi interrompere Andrea quando vuoi e cambiare liberamente discorso!
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions from the same category */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    Altri argomenti di "{TOPIC_CATEGORIES.find(c => c.id === (selectedTopic.categoryId || selectedCategory))?.title || TOPIC_CATEGORIES.find(c => c.id === (selectedTopic.categoryId || selectedCategory))?.titleIt}"
                  </span>
                  <button
                    onClick={() => setIsTopicModalOpen(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer"
                  >
                    Vedi tutti & proponi il tuo argomento →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CURATED_TOPICS.filter((t) => t.categoryId === (selectedTopic.categoryId || selectedCategory)).map((topic) => {
                    const isSelected = selectedTopic.id === topic.id;
                    return (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicChange(topic)}
                        className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-400 text-white shadow-xs ring-1 ring-amber-400/40'
                            : 'bg-stone-900/50 hover:bg-stone-850 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wide">
                            {topic.category}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-white mt-1 line-clamp-1">
                          {topic.title}
                        </p>
                        <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-2">
                          {topic.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 py-3 px-4 text-center text-xs text-stone-500">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Maestro Italiano • Chiamate Live Adattive</span>
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-400" />
            Gemini 3.8 Live API
          </span>
        </div>
      </footer>

      {/* Topic Selector Modal */}
      <TopicSelectorModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onSelectTopic={(topic) => handleTopicChange(topic)}
        currentTopicId={selectedTopic.id}
      />

      {/* Memory & Profile Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memory={memory}
        onMemoryUpdate={(updated) => setMemory(updated)}
      />
    </div>
  );
}
