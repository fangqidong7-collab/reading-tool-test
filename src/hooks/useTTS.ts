'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export const SPEED_OPTIONS = [
  { label: '0.75x', speechRate: -15, playbackRate: 0.75 },
  { label: '1.0x', speechRate: 0, playbackRate: 1.0 },
  { label: '1.25x', speechRate: 15, playbackRate: 1.25 },
  { label: '1.5x', speechRate: 30, playbackRate: 1.5 },
  { label: '2.0x', speechRate: 50, playbackRate: 2.0 },
];

interface UseTTSOptions {
  onComplete?: () => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { onComplete } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);
  const speedIndexRef = useRef(1);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
    audioCacheRef.current.clear();
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setError(null);
  }, [cleanup]);

  const fetchAudio = useCallback(async (text: string, cacheKey: string): Promise<string | null> => {
    const cached = audioCacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const speed = SPEED_OPTIONS[speedIndexRef.current];
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speechRate: speed?.speechRate ?? 0 }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.audioUri) {
        audioCacheRef.current.set(cacheKey, data.audioUri);
        return data.audioUri;
      }
    } catch { /* ignore prefetch errors */ }
    return null;
  }, []);

  const playAudioUri = useCallback((uri: string) => {
    cleanup();
    stoppedRef.current = false;
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);
    setIsLoading(false);

    const speed = SPEED_OPTIONS[speedIndexRef.current];
    const audio = new Audio(uri);
    audio.playbackRate = speed?.playbackRate ?? 1.0;
    audioRef.current = audio;

    audio.onended = () => {
      if (stoppedRef.current) return;
      setIsPlaying(false);
      setIsPaused(false);
      onCompleteRef.current?.();
    };
    audio.onerror = () => {
      if (stoppedRef.current) return;
      setIsPlaying(false);
      setError('Audio playback failed');
      onCompleteRef.current?.();
    };

    audio.play().catch(() => {
      if (stoppedRef.current) return;
      setIsPlaying(false);
      setError('Audio play failed');
      onCompleteRef.current?.();
    });
  }, [cleanup]);

  const play = useCallback(async (text: string, cacheKey?: string) => {
    cleanup();
    stoppedRef.current = false;
    setIsLoading(true);
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);

    try {
      const key = cacheKey || text;
      const uri = await fetchAudio(text, key);
      if (stoppedRef.current) return;
      if (!uri) throw new Error('TTS returned no audio');
      playAudioUri(uri);
    } catch (err: unknown) {
      if (stoppedRef.current) return;
      const msg = err instanceof Error ? err.message : 'TTS failed';
      console.error('[TTS]', msg);
      setIsLoading(false);
      setIsPlaying(false);
      setError(msg);
      onCompleteRef.current?.();
    }
  }, [cleanup, fetchAudio, playAudioUri]);

  const pause = useCallback(() => {
    if (audioRef.current && !isPaused) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPaused]);

  const resume = useCallback(async () => {
    if (audioRef.current && isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      await audioRef.current.play();
    }
  }, [isPaused]);

  const setSpeed = useCallback((index: number) => {
    const opt = SPEED_OPTIONS[index];
    if (!opt) return;
    speedIndexRef.current = index;
    setSpeedIndex(index);
    if (audioRef.current) {
      audioRef.current.playbackRate = opt.playbackRate;
    }
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return {
    isPlaying,
    isPaused,
    isLoading,
    speedIndex,
    error,
    play,
    playAudioUri,
    fetchAudio,
    stop,
    pause,
    resume,
    setSpeed,
  };
}
