import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ExternalLink } from 'lucide-react';

interface PodcastPlayerProps {
  title: string;
  audioUrl: string;
  duration: string;
  link?: string;
  author: string;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
  title,
  audioUrl,
  duration,
  link,
  author,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, audioDuration || 3600));
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 0.8];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 shadow-md border border-stone-800">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
            <span className="font-mono uppercase tracking-wider">Audio Originale WDR COSMO</span>
            <span aria-hidden="true">·</span>
            <span>{author}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{duration}</span>
          </div>
          <h3 className="font-serif text-lg md:text-xl font-medium text-stone-100 line-clamp-1">
            {title}
          </h3>
        </div>

        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stone-400 hover:text-stone-200 transition-colors inline-flex items-center gap-1 shrink-0 self-start md:self-auto"
          >
            <span>Mediathek WDR</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Progress slider */}
      <div className="space-y-1 mb-4">
        <input
          type="range"
          min={0}
          max={audioDuration || 1200}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex justify-between text-xs font-mono tabular-nums text-stone-400">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(audioDuration || (parseInt(duration.split(':')[0], 10) * 60 + parseInt(duration.split(':')[1] || '0', 10)))}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSkip(-15)}
            className="p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer rounded-full hover:bg-stone-800"
            title="Indietro di 15 secondi"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-stone-950 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
            title={isPlaying ? 'Pausa' : 'Riproduci podcast'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleSkip(15)}
            className="p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer rounded-full hover:bg-stone-800"
            title="Avanti di 15 secondi"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-1 text-xs font-mono font-medium rounded border border-stone-700 text-stone-300 hover:text-stone-100 hover:border-stone-500 transition-colors cursor-pointer"
            title="Velocità di riproduzione"
          >
            {playbackRate}x
          </button>

          <button
            onClick={toggleMute}
            className="text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title={isMuted ? 'Riattiva audio' : 'Silenzia'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-amber-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
