import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PodcastEpisode, EpisodeAnalysis } from '../types.ts';
import {
  Phone,
  PhoneOff,
  Radio,
  FileText,
  VolumeX,
  Volume2,
  Mic,
  MicOff,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface LiveAudioModeProps {
  episode: PodcastEpisode;
  analysis: EpisodeAnalysis | null;
  onOpenDossier: () => void;
}

export const LiveAudioMode: React.FC<LiveAudioModeProps> = ({
  episode,
  analysis,
  onOpenDossier,
}) => {
  // Call status matching reference architecture
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [isSilviaSpeaking, setIsSilviaSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for real-time Web Audio PCM & WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isConnectingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const isInterruptedRef = useRef<boolean>(false);
  const callStateRef = useRef<'idle' | 'connecting' | 'active' | 'ended'>('idle');

  isMutedRef.current = isMuted;
  callStateRef.current = callState;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Convert Float32Array to 16-bit linear PCM base64
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

  // Instant interruption: stop all queued audio chunks immediately (used on Gemini barge-in & button click)
  const stopAllAudio = useCallback(() => {
    isInterruptedRef.current = true;
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsSilviaSpeaking(false);
  }, []);

  // Play incoming raw 24kHz PCM chunk from Gemini Live with gapless scheduling
  const playPcmChunk = useCallback((base64Audio: string) => {
    if (!outputCtxRef.current) return;
    const ctx = outputCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // If an interruption was triggered, ignore stale audio chunks
    if (isInterruptedRef.current) {
      return;
    }

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Safe allocation: ensure multiple of 2 bytes
      const sampleCount = Math.floor(bytes.byteLength / 2);
      if (sampleCount <= 0) return;

      const int16Array = new Int16Array(bytes.buffer, 0, sampleCount);
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
      setIsSilviaSpeaking(true);

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
        if (activeSourcesRef.current.length === 0) {
          setIsSilviaSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Error decoding/playing PCM audio:', err);
    }
  }, []);

  // End live call and release hardware resources cleanly
  const endCall = useCallback(() => {
    isConnectingRef.current = false;
    stopAllAudio();

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
    setCallState('idle');
  }, [stopAllAudio]);

  // Handle explicit interruption by user (voice or button)
  const handleUserInterrupt = useCallback(() => {
    stopAllAudio();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, [stopAllAudio]);

  // Start real-time Gemini 3.8 Live session (with strict reentrancy & echo-cancellation guards)
  const startCall = async () => {
    // 1. Reentrancy guard: strictly prevent duplicate parallel connections on quick clicks
    if (isConnectingRef.current || callState === 'connecting' || callState === 'active') {
      return;
    }
    isConnectingRef.current = true;

    // Teardown any leftover resource cleanly first
    if (wsRef.current || inputCtxRef.current || outputCtxRef.current) {
      endCall();
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      setErrorMessage(null);
      setCallState('connecting');
      setCallDuration(0);
      isInterruptedRef.current = false;

      // 2. Setup AudioContexts (16kHz in, 24kHz out for Gemini Live)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      // 3. Request microphone stream with browser acoustic echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 4. Connect to WebSocket Live endpoint with Kore voice & episode context
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const topicParam = encodeURIComponent(episode.title);
      const summaryParam = encodeURIComponent((analysis?.summary || episode.description).slice(0, 300));
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=Kore&topic=${topicParam}&summary=${summaryParam}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        setCallState('active');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            isConnectingRef.current = false;
            setCallState('active');
          } else if (data.type === 'audio' && data.audio) {
            playPcmChunk(data.audio);
          } else if (data.type === 'interrupted') {
            // Native acoustic barge-in from Gemini Live: instant audio stop
            stopAllAudio();
          } else if (data.type === 'user_transcript' && data.text) {
            // User spoken input recognized by Gemini Live acoustic model
            isInterruptedRef.current = false; // Reset interrupted flag as user spoke
          } else if (data.type === 'model_transcript' && data.text) {
            // Model response recognized
          } else if (data.type === 'error') {
            setErrorMessage(data.message || 'Errore nella sessione Live');
            endCall();
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
        setErrorMessage('Connessione WebSocket non riuscita. Riprova tra poco.');
        endCall();
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        if (callStateRef.current === 'active') {
          endCall();
        }
      };

      // 5. Hook microphone ScriptProcessor (2048 buffer = ~128ms chunk for half latency and faster barge-in)
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);

      // CRITICAL FIX FOR ECHO & DUPLICATION:
      // Route the processor through a zero-gain node so onaudioprocess runs in the Web Audio graph
      // WITHOUT emitting raw microphone audio back into the computer's speakers!
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;

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

        // If user speaks while Silvia is talking, reset the interruption latch
        if (level > 25) {
          isInterruptedRef.current = false;
        }

        if (ws.readyState === WebSocket.OPEN) {
          const base64Pcm = float32ToPcmBase64(inputData);
          ws.send(JSON.stringify({ audio: base64Pcm }));
        }
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);
    } catch (err: any) {
      console.error('Call initialization error:', err);
      isConnectingRef.current = false;
      setCallState('idle');
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMessage('Accesso al microfono negato dal browser. Abilita i permessi nella barra degli indirizzi e riprova.');
      } else {
        setErrorMessage('Impossibile accedere al microfono o avviare la chiamata Live. Verifica i dispositivi audio.');
      }
    }
  };

  // Call duration timer
  useEffect(() => {
    let timer: any = null;
    if (callState === 'active') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // Organic Canvas Soundwave Loop reacting to live audio level
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      phase += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 36;
      const barWidth = 6;
      const gap = 7;
      const totalWidth = numBars * (barWidth + gap) - gap;
      const startX = (width - totalWidth) / 2;
      const centerY = height / 2;

      for (let i = 0; i < numBars; i++) {
        const x = startX + i * (barWidth + gap);
        const wave = Math.sin(phase + i * 0.3) * 6;

        let barHeight = 8;
        let fillStyle = 'rgba(120, 113, 108, 0.25)';

        if (callState === 'connecting') {
          // Connecting breathing pulse
          const loadWave = Math.sin(phase * 2 + i * 0.5) * 12 + 16;
          barHeight = Math.max(6, loadWave);
          fillStyle = `rgba(245, 158, 11, ${0.35 + Math.abs(Math.sin(phase + i * 0.2)) * 0.45})`;
        } else if (isSilviaSpeaking) {
          // Silvia speaking in Kore voice: warm amber glow
          const dynamicBoost = Math.sin(phase * 1.6 + i * 0.4) * 20 + 24;
          barHeight = Math.max(8, dynamicBoost);
          fillStyle = `rgba(217, 119, 6, ${0.5 + Math.abs(Math.sin(phase + i * 0.25)) * 0.5})`;
        } else if (callState === 'active' && audioLevel > 15) {
          // User speaking into open microphone: emerald waves reacting to real voice level
          const volBoost = (audioLevel / 100) * 55;
          barHeight = Math.max(8, 12 + wave + volBoost);
          fillStyle = `rgba(16, 185, 129, ${0.55 + (audioLevel / 100) * 0.45})`;
        } else if (callState === 'active') {
          // Live standby: calm emerald breathing wave
          barHeight = Math.max(6, 8 + wave * 0.6);
          fillStyle = 'rgba(16, 185, 129, 0.4)';
        }

        ctx.beginPath();
        ctx.fillStyle = fillStyle;
        ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [callState, isSilviaSpeaking, audioLevel]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[680px] max-w-4xl mx-auto px-4 py-6">
      {/* Editorial Header */}
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-800 mb-3">
        <Radio className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
        <span>Gemini 3.8 Live API • Audio Duplex a 16kHz/24kHz senza Latenza</span>
      </div>

      <div className="text-center max-w-2xl mb-6 space-y-1.5">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight leading-snug">
          {episode.title}
        </h1>
        <div className="flex items-center justify-center gap-2 text-xs text-stone-500 font-mono">
          <span>Silvia da Firenze</span>
          <span aria-hidden="true">·</span>
          <span>Voce: Kore (Alta Fedeltà)</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700 font-semibold">Live Barge-In Acustico Nativo (~128ms)</span>
        </div>
      </div>

      {/* Main Studio Card */}
      <div className="w-full bg-stone-900 rounded-3xl p-8 md:p-10 shadow-2xl border border-stone-800 relative overflow-hidden flex flex-col items-center justify-center min-h-[440px]">
        {/* Ambient glow reacting to speaking/listening/loading */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            isSilviaSpeaking
              ? 'opacity-40 bg-gradient-to-b from-amber-600/35 via-transparent to-transparent'
              : callState === 'connecting'
              ? 'opacity-30 bg-gradient-to-b from-amber-500/25 via-transparent to-transparent'
              : callState === 'active'
              ? 'opacity-35 bg-gradient-to-b from-emerald-600/30 via-transparent to-transparent'
              : 'opacity-10 bg-radial from-stone-700 to-transparent'
          }`}
        />

        {/* Minimalist Soundwave Visualizer Canvas */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center my-4">
          <canvas
            ref={canvasRef}
            width={540}
            height={130}
            className="w-full max-w-[540px] h-[130px] block"
          />

          {/* Status Label & Timer */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  isSilviaSpeaking
                    ? 'bg-amber-400 animate-pulse'
                    : callState === 'connecting'
                    ? 'bg-amber-500 animate-ping'
                    : callState === 'active' && audioLevel > 15
                    ? 'bg-emerald-400 animate-ping'
                    : callState === 'active'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-stone-600'
                }`}
              />
              <span className="text-xs font-mono text-stone-300 tracking-wide uppercase">
                {callState === 'connecting' && 'Connessione bidirezionale a Gemini Live in corso...'}
                {callState === 'active' && isSilviaSpeaking && 'Silvia sta parlando · (Puoi interromperla parlando o premendo Interrompi)'}
                {callState === 'active' && !isSilviaSpeaking && isMuted && 'Microfono disattivato (Muto) · Clicca per riattivarlo'}
                {callState === 'active' && !isSilviaSpeaking && !isMuted && audioLevel > 15 && 'Ti sto ascoltando...'}
                {callState === 'active' && !isSilviaSpeaking && !isMuted && audioLevel <= 15 && 'Microfono aperto: parla liberamente con Silvia'}
                {callState === 'idle' && 'Pronto per la chiamata vocale in tempo reale'}
              </span>
            </div>

            {callState === 'active' && (
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Chiamata Live in corso • {formatTimer(callDuration)}</span>
              </div>
            )}
          </div>
        </div>

        {/* In-call controls: Interruption Button and Mute toggle */}
        {callState === 'active' && (
          <div className="relative z-10 flex items-center gap-3 mb-3">
            {/* Dedicated Mute/Unmute microphone button */}
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className={`p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-2 shadow-md ${
                isMuted
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/80 hover:bg-rose-900/80'
                  : 'bg-stone-800/90 text-stone-200 border-stone-700 hover:bg-stone-700/90'
              }`}
              title={isMuted ? 'Riattiva microfono' : 'Silenzia microfono'}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              <span>{isMuted ? 'Microfono Muto' : 'Microfono Attivo'}</span>
            </button>

            {/* Immediate Interruption Button */}
            {isSilviaSpeaking && (
              <button
                onClick={handleUserInterrupt}
                className="px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/50 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-md animate-fadeIn"
                title="Interrompi voce di Silvia immediatamente"
              >
                <VolumeX className="w-4 h-4 text-amber-400" />
                <span>Interrompi Silvia</span>
              </button>
            )}
          </div>
        )}

        {/* Error notification card */}
        {errorMessage && (
          <div className="relative z-10 my-3 px-5 py-3.5 bg-stone-950/95 border border-amber-500/70 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xl max-w-lg">
            <div className="flex items-center gap-2.5 text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <div className="text-left">
                <p className="font-semibold text-stone-100">Stato connessione audio</p>
                <p className="text-[11px] text-stone-400 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={startCall}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Riprova</span>
            </button>
          </div>
        )}

        {/* Primary Call Connection Button */}
        <div className="relative z-10 mt-5 flex flex-col items-center gap-3">
          <button
            onClick={callState === 'active' || callState === 'connecting' ? endCall : startCall}
            disabled={callState === 'connecting'}
            className={`px-10 py-4.5 rounded-2xl font-medium text-sm transition-all cursor-pointer shadow-xl flex items-center gap-3 hover:scale-103 active:scale-97 disabled:opacity-50 ${
              callState === 'active' || callState === 'connecting'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 ring-4 ring-red-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 ring-4 ring-emerald-600/30'
            }`}
          >
            {callState === 'active' || callState === 'connecting' ? (
              <>
                <PhoneOff className="w-5 h-5 fill-current" />
                <span>Termina Chiamata (Auflegen)</span>
              </>
            ) : (
              <>
                <Phone className="w-5 h-5 fill-current" />
                <span>Avvia Chiamata Live con Silvia</span>
              </>
            )}
          </button>

          <p className="text-xs text-stone-400 max-w-sm text-center">
            {callState === 'active'
              ? 'Connessione streaming a bassissima latenza attiva: parla liberamente o interrompi Silvia con naturalezza.'
              : 'Premi il pulsante per collegarti in tempo reale con Silvia da Firenze: audio nativo 16kHz/24kHz senza attese.'}
          </p>
        </div>
      </div>

      {/* Secondary Bottom Ribbon: Access Written Dossier */}
      <div className="mt-8 flex items-center justify-between w-full max-w-2xl px-5 py-3.5 bg-white border border-stone-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2.5 text-xs text-stone-600">
          <FileText className="w-4 h-4 text-stone-400 shrink-0" />
          <span>Vuoi consultare la sintesi scritta, il fact-checking o riascoltare l'audio WDR?</span>
        </div>

        <button
          onClick={onOpenDossier}
          className="text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer shrink-0 ml-4"
        >
          Apri Dossier Completo →
        </button>
      </div>
    </div>
  );
};
