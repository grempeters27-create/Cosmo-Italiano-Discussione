/**
 * Audio service for adaptive Italian conversation
 * Provides high-fidelity Italian Gemini TTS (with Web Speech API fallback),
 * robust microphone capture with live volume analysis,
 * and dual speech-to-text (MediaRecorder + Gemini Transcribe with Web Speech assistance).
 */

export interface VoiceCaptureCallbacks {
  onStart?: () => void;
  onInterimText?: (text: string) => void;
  onVolumeChange?: (volumePercent: number) => void;
  onError?: (err: any) => void;
}

class AudioService {
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;

  // Voice recording & analysis states
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private actualMimeType = 'audio/webm';
  private interimTranscript = '';
  private recognition: any = null;
  private isCurrentlyCapturing = false;

  private currentVoiceName: 'Puck' | 'Kore' = (() => {
    try {
      const saved = localStorage.getItem('maestro_italiano_voice_v1');
      if (saved === 'femminile') return 'Kore';
    } catch (_) {}
    return 'Puck';
  })();

  private audioCache = new Map<string, string>();

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
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): Promise<void> {
    this.stopSpeaking();
    this.isSpeaking = true;
    options.onStart?.();

    const playbackRate = options.speed === 'slow' ? 0.8 : 1.0;
    const selectedVoice = options.voice || this.currentVoiceName;
    const cacheKey = `${selectedVoice}_${options.speed || 'normal'}_${text.trim()}`;

    // Check memory cache first
    const cachedAudio = this.audioCache.get(cacheKey);
    if (cachedAudio) {
      this.playAudioSource(`data:audio/wav;base64,${cachedAudio}`, playbackRate, options, text);
      return;
    }

    // Try Gemini high-fidelity Italian TTS with 1 retry on rate-limit
    let audioReceived: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
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
        } else if (res.status === 429 || res.status === 500) {
          if (attempt === 0) {
            // Wait 1.6 seconds and retry once
            await new Promise((r) => setTimeout(r, 1600));
            continue;
          }
        }
      } catch (err) {
        console.warn(`Gemini TTS fetch attempt ${attempt} warning:`, err);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (audioReceived) {
      this.audioCache.set(cacheKey, audioReceived);
      this.playAudioSource(`data:audio/wav;base64,${audioReceived}`, playbackRate, options, text);
      return;
    }

    // If Gemini TTS is temporarily unreachable, check if the browser has a CERTIFIED Italian voice.
    // NEVER allow a German or English voice to speak Italian text!
    this.fallbackWebSpeech(text, { ...options, voice: selectedVoice });
  }

  private playAudioSource(
    audioSrc: string,
    playbackRate: number,
    options: { onEnd?: () => void; onError?: (err: any) => void; voice?: 'Puck' | 'Kore' },
    text: string
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
      console.warn('HTMLAudio error, checking Web Speech API with strict Italian verification:', e);
      this.fallbackWebSpeech(text, options);
    };

    audio.play().catch((playErr) => {
      console.warn('Audio play() prevented by browser policy or failed:', playErr);
      this.isSpeaking = false;
      this.currentAudio = null;
      options.onEnd?.();
    });
  }

  private fallbackWebSpeech(
    text: string,
    options: {
      speed?: 'normal' | 'slow';
      voice?: 'Puck' | 'Kore';
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ) {
    if (!('speechSynthesis' in window)) {
      this.isSpeaking = false;
      options.onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`[\]()]/g, '').trim();

      const voices = window.speechSynthesis.getVoices() || [];
      // STRICT FILTER: Voice MUST have Italian language tag (it-IT, it-CH, it)
      const certifiedItalianVoices = voices.filter(
        (v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('it')
      );

      // STRICT PROTECTION: If user's device does NOT have an authentic Italian voice installed,
      // DO NOT speak! Never read Italian with a German/English system voice.
      if (certifiedItalianVoices.length === 0) {
        console.warn(
          'No certified Italian voice installed in this browser. Refusing to speak to avoid foreign accent.'
        );
        this.isSpeaking = false;
        options.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'it-IT';
      utterance.rate = options.speed === 'slow' ? 0.8 : 0.96;

      const requestedVoiceGender = options.voice || this.currentVoiceName;

      let chosenVoice: SpeechSynthesisVoice | null = null;

      if (requestedVoiceGender === 'Kore') {
        // Find Italian female voice
        chosenVoice =
          certifiedItalianVoices.find((v) => {
            const n = v.name.toLowerCase();
            return (
              n.includes('female') ||
              n.includes('donna') ||
              n.includes('alice') ||
              n.includes('chiara') ||
              n.includes('federica') ||
              n.includes('lucia') ||
              n.includes('paola') ||
              n.includes('sara') ||
              n.includes('giulia')
            );
          }) || certifiedItalianVoices[0];
        utterance.pitch = 1.05;
      } else {
        // Find Italian male voice
        chosenVoice =
          certifiedItalianVoices.find((v) => {
            const n = v.name.toLowerCase();
            return (
              n.includes('male') ||
              n.includes('uomo') ||
              n.includes('luca') ||
              n.includes('cosimo') ||
              n.includes('roberto') ||
              n.includes('marco') ||
              n.includes('massimo')
            );
          }) || certifiedItalianVoices[0];
        utterance.pitch = 0.95;
      }

      // Final sanity check: MUST be verified Italian
      if (!chosenVoice || !chosenVoice.lang.toLowerCase().replace('_', '-').startsWith('it')) {
        console.warn('Selected voice is not Italian. Aborting to avoid foreign accent.');
        this.isSpeaking = false;
        options.onEnd?.();
        return;
      }

      utterance.voice = chosenVoice;

      utterance.onend = () => {
        this.isSpeaking = false;
        options.onEnd?.();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        options.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('WebSpeech synthesis error:', e);
      this.isSpeaking = false;
      options.onEnd?.();
    }
  }

  stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // --- ROBUST VOICE CAPTURE & TRANSCRIPTION ---

  isCapturing(): boolean {
    return this.isCurrentlyCapturing;
  }

  // Start microphone capture with real-time volume measurement and recording
  async startVoiceCapture(callbacks: VoiceCaptureCallbacks): Promise<boolean> {
    this.stopSpeaking();
    this.cancelVoiceCapture();

    try {
      // 1. Get raw microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.isCurrentlyCapturing = true;
      this.interimTranscript = '';
      this.recordedChunks = [];
      callbacks.onStart?.();

      // 2. Setup AudioContext and AnalyserNode for volume visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        this.audioContext = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        this.analyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!this.isCurrentlyCapturing || !this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Scale to 0-100 percentage
          const percent = Math.min(100, Math.round((average / 128) * 100));
          callbacks.onVolumeChange?.(percent);

          this.animFrameId = requestAnimationFrame(updateVolume);
        };
        this.animFrameId = requestAnimationFrame(updateVolume);
      } catch (audioErr) {
        console.warn('AudioContext volume analyzer setup warning:', audioErr);
      }

      // 3. Determine best supported MIME type for MediaRecorder
      const supportedMimes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
      ];
      let chosenMime = '';
      for (const m of supportedMimes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }
      this.actualMimeType = chosenMime || 'audio/webm';

      const options = chosenMime ? { mimeType: chosenMime } : {};
      const recorder = new MediaRecorder(stream, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      recorder.start(100);

      // 4. Concurrently start Web Speech Recognition if available to provide instant interim words
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          this.recognition = rec;
          rec.lang = 'it-IT';
          rec.continuous = true;
          rec.interimResults = true;
          rec.maxAlternatives = 1;

          rec.onresult = (event: any) => {
            let finalStr = '';
            let interimStr = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalStr += event.results[i][0].transcript;
              } else {
                interimStr += event.results[i][0].transcript;
              }
            }
            const current = finalStr || interimStr;
            if (current) {
              this.interimTranscript = current;
              callbacks.onInterimText?.(current);
            }
          };

          rec.onerror = (e: any) => {
            // Non-fatal: if Web Speech fails in iframe, MediaRecorder will handle transcription
            console.warn('Web Speech API note:', e.error);
          };

          rec.start();
        } catch (recErr) {
          console.warn('SpeechRecognition initialization note:', recErr);
        }
      }

      return true;
    } catch (err) {
      console.error('Microphone capture access failed:', err);
      this.cancelVoiceCapture();
      callbacks.onError?.(err);
      return false;
    }
  }

  // Stop recording and return transcribed Italian text (from Gemini or SpeechRecognition)
  async stopVoiceCaptureAndTranscribe(): Promise<string> {
    if (!this.isCurrentlyCapturing) {
      return this.interimTranscript.trim();
    }

    this.isCurrentlyCapturing = false;

    // Stop volume animation & Web Speech
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    // Stop MediaRecorder and collect blob
    const audioBlob = await new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.actualMimeType || 'audio/webm',
        });
        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (_) {
        resolve(null);
      }
    });

    // Close microphone tracks
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.mediaRecorder = null;

    // If Web Speech already produced a complete sentence, and audioBlob is empty, return it
    if (this.interimTranscript.trim().length > 3 && (!audioBlob || audioBlob.size < 800)) {
      return this.interimTranscript.trim();
    }

    // Otherwise, transcribe the actual recorded audio using Gemini Transcribe
    if (audioBlob && audioBlob.size > 0) {
      try {
        const base64Audio = await this.blobToBase64(audioBlob);
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioData: base64Audio,
            mimeType: this.actualMimeType || 'audio/webm',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const transcript = (data.transcript || '').trim();
          if (transcript) {
            return transcript;
          }
        }
      } catch (err) {
        console.warn('Server transcribe call failed:', err);
      }
    }

    return this.interimTranscript.trim();
  }

  // Abort voice capture without sending to transcribe
  cancelVoiceCapture() {
    this.isCurrentlyCapturing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
    }
    this.mediaRecorder = null;
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.recordedChunks = [];
    this.interimTranscript = '';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const audioService = new AudioService();
