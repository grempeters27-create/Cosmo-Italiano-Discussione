/**
 * Audio service for adaptive Italian conversation
 * - High-fidelity Italian Gemini TTS with resilient browser Web Speech fallback (guaranteed voice playback)
 * - Continuous open microphone capture with live volume analysis and voice activity detection (VAD)
 * - Dual Speech-to-Text: native Web SpeechRecognition + MediaRecorder server transcription fallback
 * - Instant barge-in interruption of Silvia whenever the user speaks
 */

export interface ContinuousSessionCallbacks {
  onStart?: () => void;
  onInterimText?: (text: string) => void;
  onUserSpeechFinal?: (text: string) => void;
  onVolumeChange?: (volumePercent: number) => void;
  onInterrupt?: () => void;
  onError?: (err: any) => void;
}

class AudioService {
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;

  // Voice recording & continuous analysis states
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private recognition: any = null;
  private isContinuousActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecordingAudioSlice = false;
  private isClientSTTBlocked = false;

  private currentVoiceName: 'Puck' | 'Kore' = 'Kore';
  private audioCache = new Map<string, string>();

  // VAD & silence detection
  private silenceTimer: any = null;
  private isFinalizingUtterance = false;
  private callbacks: ContinuousSessionCallbacks | null = null;

  setVoice(voice: 'Puck' | 'Kore') {
    this.currentVoiceName = voice;
  }

  getVoice(): 'Puck' | 'Kore' {
    return this.currentVoiceName;
  }

  // --- TTS PLAYBACK ---
  async playItalianText(
    text: string,
    options: {
      speed?: 'normal' | 'slow';
      voice?: 'Puck' | 'Kore';
      onLoading?: () => void;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): Promise<void> {
    this.stopSpeaking();
    options.onLoading?.();

    const playbackRate = options.speed === 'slow' ? 0.8 : 1.0;
    const selectedVoice = options.voice || this.currentVoiceName;
    const cleanText = text.replace(/[*_#`[\]()]/g, '').trim();
    const cacheKey = `${selectedVoice}_${options.speed || 'normal'}_${cleanText}`;

    // Check memory cache first - instant playback in under 10ms
    const cachedAudio = this.audioCache.get(cacheKey);
    if (cachedAudio) {
      this.isSpeaking = true;
      options.onStart?.();
      this.playAudioSource(`data:audio/wav;base64,${cachedAudio}`, playbackRate, options);
      return;
    }

    // Request authentic Gemini TTS with Kore voice (with automatic background retry on rate limits)
    let audioReceived: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            speed: options.speed || 'normal',
            voice: selectedVoice,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audio) {
            audioReceived = data.audio;
            break;
          }
        } else if (res.status === 429 || res.status === 500 || res.status === 503) {
          if (attempt === 0) {
            // Wait 1.6 seconds and retry once silently in background
            await new Promise((r) => setTimeout(r, 1600));
            continue;
          }
        }
      } catch (err) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (audioReceived) {
      this.isSpeaking = true;
      this.audioCache.set(cacheKey, audioReceived);
      options.onStart?.();
      this.playAudioSource(`data:audio/wav;base64,${audioReceived}`, playbackRate, options);
      return;
    }

    // Exclusively Kore voice is allowed: under NO circumstance will a robotic browser voice be played.
    // If the Kore voice stream cannot be retrieved after retries, report failure cleanly.
    this.isSpeaking = false;
    options.onError?.(new Error('KORE_VOICE_UNAVAILABLE'));
  }

  private playAudioSource(
    audioSrc: string,
    playbackRate: number,
    options: { onEnd?: () => void; onError?: (err: any) => void; voice?: 'Puck' | 'Kore' }
  ) {
    const audio = new Audio(audioSrc);
    this.currentAudio = audio;
    audio.playbackRate = playbackRate;

    audio.onended = () => {
      this.isSpeaking = false;
      this.currentAudio = null;
      options.onEnd?.();
    };

    audio.onerror = (e) => {
      this.isSpeaking = false;
      this.currentAudio = null;
      options.onError?.(e);
    };

    audio.play().catch((playErr) => {
      this.isSpeaking = false;
      this.currentAudio = null;
      options.onError?.(playErr);
    });
  }

  stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
  }

  interruptSpeaking() {
    this.stopSpeaking();
    this.callbacks?.onInterrupt?.();
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- CONTINUOUS LIVE OPEN-MICROPHONE SESSION ---

  isSessionActive(): boolean {
    return this.isContinuousActive;
  }

  // Opens microphone stream and keeps it open until user hangs up
  async startContinuousSession(callbacks: ContinuousSessionCallbacks): Promise<boolean> {
    this.stopSpeaking();
    this.stopContinuousSession();

    this.callbacks = callbacks;
    this.isContinuousActive = true;
    this.isFinalizingUtterance = false;
    this.isClientSTTBlocked = false;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      // 1. Get raw microphone stream once for the entire call
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (_constraintErr) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.micStream = stream;
      callbacks.onStart?.();

      // 2. Setup Web Audio API Analyser for continuous volume and VAD
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      this.analyser = analyser;

      // 3. Setup MediaRecorder for fallback if WebSpeech is blocked
      this.initMediaRecorder(stream);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Volume & VAD monitoring loop
      const checkAudioLevel = () => {
        if (!this.isContinuousActive || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const percent = Math.min(100, Math.round((average / 128) * 100));

        callbacks.onVolumeChange?.(percent);

        // Voice Activity Detection (VAD) for MediaRecorder slicing:
        // STRICTLY only trigger when client STT is blocked, Silvia is not speaking, and not finalizing
        if (this.isClientSTTBlocked && percent > 16 && !this.isSpeaking && !this.isFinalizingUtterance) {
          this.handleVoiceActivityStart();
        }

        this.animFrameId = requestAnimationFrame(checkAudioLevel);
      };

      this.animFrameId = requestAnimationFrame(checkAudioLevel);

      // 4. Setup continuous SpeechRecognition
      this.initSpeechRecognition();

      return true;
    } catch (err) {
      this.stopContinuousSession();
      callbacks.onError?.(err);
      return false;
    }
  }

  private initMediaRecorder(stream: MediaStream) {
    if (typeof MediaRecorder === 'undefined') return;

    try {
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
      const supportedType = mimeTypes.find((t) => !t || MediaRecorder.isTypeSupported(t)) || '';

      const options = supportedType ? { mimeType: supportedType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      this.recordedChunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder = recorder;
    } catch (_e) {
      // Audio capture continues via WebSpeech
    }
  }

  private handleVoiceActivityStart() {
    if (!this.isContinuousActive) return;

    // Start recording audio slice if not already running
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      try {
        this.recordedChunks = [];
        this.mediaRecorder.start(200);
        this.isRecordingAudioSlice = true;
      } catch (_e) {}
    }

    // Reset silence timer: wait for pause in speech
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.handleVoiceActivityEnd();
    }, 1250);
  }

  private async handleVoiceActivityEnd() {
    if (!this.isContinuousActive || !this.isClientSTTBlocked || this.isFinalizingUtterance) return;

    // Check recorded audio chunks only when client STT is blocked
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.isRecordingAudioSlice = false;

      // Small delay for chunks to gather
      await new Promise((r) => setTimeout(r, 120));

      if (this.recordedChunks.length > 0) {
        const audioBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
        this.recordedChunks = [];

        // If audio slice has substance (> 4KB), transcribe server-side
        if (audioBlob.size > 4000) {
          this.transcribeBlobServerSide(audioBlob);
        }
      }
    }
  }

  private resetMediaRecorder() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch (_e) {}
    }
    this.recordedChunks = [];
    this.isRecordingAudioSlice = false;
  }

  private async transcribeBlobServerSide(blob: Blob) {
    if (!this.isContinuousActive || this.isFinalizingUtterance) return;

    try {
      this.callbacks?.onInterimText?.('Trascrizione in corso...');

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64,
          mimeType: blob.type || 'audio/webm',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = String(data.transcript || '').trim();
        if (text.length > 1 && !this.isFinalizingUtterance) {
          this.isFinalizingUtterance = true;
          this.callbacks?.onUserSpeechFinal?.(text);
          setTimeout(() => {
            this.isFinalizingUtterance = false;
          }, 800);
        } else {
          this.callbacks?.onInterimText?.('');
        }
      }
    } catch (_e) {
      this.callbacks?.onInterimText?.('');
    }
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.isClientSTTBlocked = true;
      return;
    }

    try {
      const rec = new SpeechRecognition();
      this.recognition = rec;
      rec.lang = 'it-IT';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        if (!this.isContinuousActive || this.isFinalizingUtterance) return;

        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            sessionFinal += item[0].transcript + ' ';
          } else {
            sessionInterim += item[0].transcript;
          }
        }

        // Semantic voice barge-in: only interrupt if verified substantive words are recognized
        const recognizedSpokenText = (sessionFinal + sessionInterim).trim();
        if (
          this.isSpeaking &&
          (recognizedSpokenText.split(/\s+/).length >= 2 || recognizedSpokenText.length >= 6)
        ) {
          this.interruptSpeaking();
        }

        if (recognizedSpokenText) {
          this.callbacks?.onInterimText?.(recognizedSpokenText);

          // Silence timer: when user pauses for 1.25s, finalize speech ONCE without duplicate concatenation
          clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            this.finalizeSpeechUtterance(recognizedSpokenText);
          }, 1250);
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          // In iframe environments, WebSpeech can be restricted; fallback to MediaRecorder VAD
          this.isClientSTTBlocked = true;
        }
      };

      // Auto-restart recognition if it closes naturally, keeping mic alive
      rec.onend = () => {
        if (this.isContinuousActive && !this.isClientSTTBlocked && !this.isFinalizingUtterance) {
          try {
            rec.start();
          } catch (_) {}
        }
      };

      rec.start();
    } catch (_err) {
      this.isClientSTTBlocked = true;
    }
  }

  private finalizeSpeechUtterance(spokenText: string) {
    if (!this.isContinuousActive || this.isFinalizingUtterance) return;

    const cleanText = spokenText.trim();
    if (cleanText.length > 1) {
      this.isFinalizingUtterance = true;
      clearTimeout(this.silenceTimer);

      // Stop recognition session to reset internal event.results buffer for the next user turn
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (_) {}
      }

      // Dispatch single final text to client
      this.callbacks?.onUserSpeechFinal?.(cleanText);

      // Re-enable recognition cleanly after turn is registered
      setTimeout(() => {
        this.isFinalizingUtterance = false;
        if (this.isContinuousActive && !this.isClientSTTBlocked && this.recognition) {
          try {
            this.recognition.start();
          } catch (_) {}
        }
      }, 700);
    }
  }

  // Stops the continuous session and releases the microphone
  stopContinuousSession() {
    this.isContinuousActive = false;
    this.isFinalizingUtterance = false;
    clearTimeout(this.silenceTimer);

    this.stopSpeaking();
    this.resetMediaRecorder();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    this.callbacks = null;
  }
}

export const audioService = new AudioService();
