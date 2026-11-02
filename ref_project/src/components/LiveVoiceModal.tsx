import React, { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, Sparkles, AlertCircle, Radio } from 'lucide-react';
import { VoiceGender } from '../types';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  teacherVoice: VoiceGender;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  topicTitle,
  teacherVoice,
}) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTeacherSpeaking, setIsTeacherSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  isMutedRef.current = isMuted;

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

  // Play raw 24kHz PCM chunk
  const playPcmChunk = (base64Audio: string) => {
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
  };

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsTeacherSpeaking(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    let cleanup = false;

    const startSession = async () => {
      try {
        setStatus('connecting');
        setErrorMessage(null);

        // 1. Setup AudioContexts
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000,
        });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
        inputCtxRef.current = inputCtx;
        outputCtxRef.current = outputCtx;

        // 2. Get mic stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        micStreamRef.current = stream;

        // 3. Connect WebSocket to /api/live with chosen voice
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const voiceParam = teacherVoice === 'femminile' ? 'Kore' : 'Puck';
        const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${voiceParam}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cleanup) return;
          setStatus('connected');
        };

        ws.onmessage = (event) => {
          if (cleanup) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setStatus('connected');
            } else if (data.type === 'audio' && data.audio) {
              playPcmChunk(data.audio);
            } else if (data.type === 'interrupted') {
              stopAllAudio();
            } else if (data.type === 'error') {
              setStatus('error');
              setErrorMessage(data.message || 'Errore nella sessione vocale Live');
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = () => {
          if (cleanup) return;
          setStatus('error');
          setErrorMessage('Connessione WebSocket non riuscita.');
        };

        ws.onclose = () => {
          if (cleanup) return;
          if (status !== 'error') {
            setStatus('disconnected');
          }
        };

        // 4. Hook microphone processor to stream audio
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (cleanup || isMutedRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);

          // Simple RMS volume level indicator
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setAudioLevel(Math.min(100, Math.round(rms * 400)));

          if (ws.readyState === WebSocket.OPEN) {
            const base64Pcm = float32ToPcmBase64(inputData);
            ws.send(JSON.stringify({ audio: base64Pcm }));
          }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      } catch (err: any) {
        console.error('Live voice initialization error:', err);
        setStatus('error');
        setErrorMessage(
          err.name === 'NotAllowedError'
            ? 'Accesso al microfono negato dal browser.'
            : 'Impossibile connettersi al modello Live. Verifica il microfono o usa la modalità audio standard.'
        );
      }
    };

    startSession();

    return () => {
      cleanup = true;
      stopAllAudio();

      if (wsRef.current) {
        wsRef.current.close();
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
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative flex flex-col items-center text-center">
        {/* Live indicator badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-xs font-medium mb-6">
          <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span className="text-stone-300">Gemini 3.8 Live API • Chiamata Vocale</span>
        </div>

        {/* Avatar visualizer */}
        <div className="relative my-4">
          {/* Animated concentric rings */}
          <div
            className={`absolute -inset-4 rounded-full transition-all duration-300 ${
              isTeacherSpeaking
                ? 'bg-amber-500/20 scale-110 animate-ping'
                : audioLevel > 15
                ? 'bg-emerald-500/20 scale-105 animate-pulse'
                : 'bg-transparent'
            }`}
          />
          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all duration-300 ${
              isTeacherSpeaking
                ? 'bg-gradient-to-tr from-amber-600 to-amber-400 ring-4 ring-amber-300 scale-105'
                : 'bg-stone-800 border-2 border-stone-700'
            }`}
          >
            {teacherVoice === 'femminile' ? '👩‍🏫' : '👨‍🏫'}
          </div>
        </div>

        {/* Teacher name & status */}
        <h2 className="font-serif-italian text-2xl font-bold mt-2">
          Andrea ({teacherVoice === 'femminile' ? 'Voce Donna' : 'Voce Uomo'})
        </h2>
        <p className="text-xs text-amber-300 font-medium mt-1">Tema: {topicTitle}</p>

        {/* State description */}
        <div className="h-10 flex items-center justify-center my-4">
          {status === 'connecting' && (
            <span className="text-xs text-stone-400 animate-pulse">
              Connessione in corso a Gemini Live...
            </span>
          )}
          {status === 'connected' && isTeacherSpeaking && (
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
              <Volume2 className="w-4 h-4" /> Andrea sta parlando in italiano...
            </span>
          )}
          {status === 'connected' && !isTeacherSpeaking && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Ti ascolto! Parla pure...
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {errorMessage}
            </span>
          )}
        </div>

        {/* Waveform indicator (fixed height, no layout jitter) */}
        <div className="flex items-center justify-center gap-1.5 h-6 mb-6">
          {[1, 2, 3, 4, 5].map((barIdx) => (
            <span
              key={barIdx}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                isTeacherSpeaking
                  ? 'bg-amber-400 h-5'
                  : audioLevel > 15
                  ? 'bg-emerald-400 h-4'
                  : 'bg-stone-700 h-1.5'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-all shadow-md ${
              isMuted
                ? 'bg-stone-800 text-stone-400 border border-stone-700 hover:bg-stone-700'
                : 'bg-stone-800 text-emerald-400 border border-stone-700 hover:bg-stone-700'
            }`}
            title={isMuted ? 'Riattiva microfono' : 'Disattiva microfono'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={onClose}
            className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-2 shadow-lg shadow-rose-900/50 active:scale-95 transition-all"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Termina Chiamata</span>
          </button>
        </div>

        <p className="text-[11px] text-stone-500 mt-6 max-w-xs">
          La conversazione avviene in tempo reale via WebSocket duplex con audio nativo a 16kHz/24kHz.
        </p>
      </div>
    </div>
  );
};
