/**
 * Web Audio API Full-Duplex Client for Gemini 3.8 Live API
 * Input: 16kHz PCM (Mic capture)
 * Output: 24kHz PCM (Model output playback with queue & interruption support)
 */

export class LiveAudioSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private activeSources: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  private isMuted: boolean = false;
  private isConnected: boolean = false;

  private onStatusChange: (status: 'connecting' | 'connected' | 'speaking' | 'listening' | 'disconnected' | 'error', errorMsg?: string) => void;

  constructor(callbacks: {
    onStatusChange: (status: 'connecting' | 'connected' | 'speaking' | 'listening' | 'disconnected' | 'error', errorMsg?: string) => void;
  }) {
    this.onStatusChange = callbacks.onStatusChange;
  }

  public async start(episodeContext: { title: string; summary: string }) {
    try {
      this.onStatusChange('connecting');

      // 1. Initialize output AudioContext (24kHz for Gemini Live model output)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 64;
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
      this.nextPlayTime = this.outputAudioCtx.currentTime;

      // 2. Initialize input AudioContext (16kHz for Gemini Live input)
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 64;

      // 3. Request user microphone
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const sourceNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      // Connect to analyser for mic volume measurement
      sourceNode.connect(this.inputAnalyser);

      // Buffer size 4096 gives ~256ms chunk at 16kHz
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const floatData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(floatData);
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        this.ws.send(JSON.stringify({ audio: base64Audio }));
      };

      sourceNode.connect(this.micProcessor);
      this.micProcessor.connect(this.inputAudioCtx.destination);

      // 4. Connect WebSocket to backend /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onStatusChange('connected');

        // Send initial setup payload with episode context to trigger Silvia's opening greeting
        this.ws?.send(
          JSON.stringify({
            type: 'init',
            title: episodeContext.title,
            summary: episodeContext.summary,
          })
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'interrupted' || data.interrupted) {
            this.handleInterruption();
            this.onStatusChange('listening');
            return;
          }

          if (data.type === 'connected' || data.status === 'connected') {
            this.onStatusChange('connected');
            return;
          }

          const audioPayload = data.audio || (data.type === 'audio' && data.audio);
          if (audioPayload) {
            this.playAudioChunk(audioPayload);
            this.onStatusChange('speaking');
          }

          if (data.status === 'listening') {
            this.onStatusChange('listening');
          }

          if (data.error) {
            console.warn('Live API server message:', data.error);
            if (data.error === 'live_unavailable') {
              this.onStatusChange('error', 'Gemini Live bridge al momento non raggiungibile.');
            }
          }
        } catch (err) {
          console.warn('Error parsing WS message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        this.onStatusChange('error', 'Errore di connessione audio.');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onStatusChange('disconnected');
      };
    } catch (err: any) {
      console.error('Failed to start Live Audio session:', err);
      this.onStatusChange('error', err?.message || 'Accesso al microfono non consentito');
    }
  }

  private handleInterruption() {
    // Flush queued buffers immediately when user starts speaking
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
  }

  private playAudioChunk(base64Pcm: string) {
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    try {
      const binaryStr = window.atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert 16-bit linear PCM little-endian to Float32
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAnalyser);

      const now = this.outputAudioCtx.currentTime;
      const startTime = Math.max(now, this.nextPlayTime);
      source.start(startTime);

      this.nextPlayTime = startTime + audioBuffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          this.onStatusChange('listening');
        }
      };
    } catch (err) {
      console.warn('Error playing live audio chunk:', err);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getIsMuted() {
    return this.isMuted;
  }

  public getVisualizerData(): { silviaVolume: number; userVolume: number; frequencies: Uint8Array } {
    let silviaVolume = 0;
    let userVolume = 0;
    const frequencies = new Uint8Array(16);

    if (this.outputAnalyser) {
      const outData = new Uint8Array(this.outputAnalyser.frequencyBinCount);
      this.outputAnalyser.getByteFrequencyData(outData);
      let sum = 0;
      for (let i = 0; i < outData.length; i++) {
        sum += outData[i];
      }
      silviaVolume = sum / (outData.length * 255);
      for (let i = 0; i < 16; i++) {
        frequencies[i] = outData[i] || 0;
      }
    }

    if (this.inputAnalyser && !this.isMuted) {
      const inData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
      this.inputAnalyser.getByteFrequencyData(inData);
      let sum = 0;
      for (let i = 0; i < inData.length; i++) {
        sum += inData[i];
      }
      userVolume = sum / (inData.length * 255);
      if (userVolume > silviaVolume) {
        for (let i = 0; i < 16; i++) {
          frequencies[i] = inData[i] || 0;
        }
      }
    }

    return { silviaVolume, userVolume, frequencies };
  }

  public stop() {
    this.handleInterruption();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    this.isConnected = false;
    this.onStatusChange('disconnected');
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer as ArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
