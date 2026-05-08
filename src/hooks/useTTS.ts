'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export const SPEED_OPTIONS = [
  { label: '0.75x', speechRate: -15, playbackRate: 0.75 },
  { label: '1.0x', speechRate: 0, playbackRate: 1.0 },
  { label: '1.25x', speechRate: 15, playbackRate: 1.25 },
  { label: '1.5x', speechRate: 30, playbackRate: 1.5 },
  { label: '2.0x', speechRate: 50, playbackRate: 2.0 },
];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

interface UseTTSOptions {
  onComplete?: () => void;
  onError?: (msg: string) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { onComplete, onError } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);
  const speedIndexRef = useRef(1);
  const retryCountRef = useRef(0);
  const playSeqRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const getOrCreateAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return audio;
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    retryCountRef.current = 0;
    playSeqRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioCacheRef.current.clear();
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setError(null);
  }, []);

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

  const attemptPlay = useCallback((audio: HTMLAudioElement, seq: number) => {
    if (stoppedRef.current || seq !== playSeqRef.current) return;

    const speed = SPEED_OPTIONS[speedIndexRef.current];
    audio.playbackRate = speed?.playbackRate ?? 1.0;

    console.log(`[TTS] attempting play, seq=${seq}, retry=${retryCountRef.current}`);

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        if (seq !== playSeqRef.current) return;
        console.log('[TTS] play() started successfully');
        setIsLoading(false);
        setIsPlaying(true);
      }).catch((e) => {
        if (stoppedRef.current || seq !== playSeqRef.current) return;
        console.warn(`[TTS] play() rejected: ${e?.message}`);
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = RETRY_DELAY_MS * retryCountRef.current;
          console.warn(`[TTS] will retry in ${delay}ms (${retryCountRef.current}/${MAX_RETRIES})`);
          setTimeout(() => attemptPlay(audio, seq), delay);
        } else {
          retryCountRef.current = 0;
          setIsPlaying(false);
          setIsLoading(false);
          setError('Audio play blocked');
          onErrorRef.current?.('Audio play blocked');
        }
      });
    }
  }, []);

  const playAudioUri = useCallback((uri: string) => {
    const seq = ++playSeqRef.current;
    stoppedRef.current = false;
    retryCountRef.current = 0;
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);
    setIsLoading(true);

    const audio = getOrCreateAudio();
    audio.pause();

    audio.onended = () => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
      console.log('[TTS] sentence ended, calling onComplete');
      retryCountRef.current = 0;
      setIsPlaying(false);
      setIsPaused(false);
      onCompleteRef.current?.();
    };

    audio.onerror = () => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
      console.warn(`[TTS] audio error event, retry=${retryCountRef.current}`);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        const delay = RETRY_DELAY_MS * retryCountRef.current;
        setTimeout(() => {
          if (stoppedRef.current || seq !== playSeqRef.current) return;
          audio.src = uri;
          audio.load();
          attemptPlay(audio, seq);
        }, delay);
        return;
      }
      retryCountRef.current = 0;
      setIsPlaying(false);
      setIsLoading(false);
      setError('Audio playback failed');
      onErrorRef.current?.('Audio playback failed');
    };

    audio.src = uri;
    audio.load();
    attemptPlay(audio, seq);
  }, [getOrCreateAudio, attemptPlay]);

  const play = useCallback(async (text: string, cacheKey?: string) => {
    if (!/[a-zA-Z0-9\u4e00-\u9fff]/.test(text)) {
      console.log(`[TTS] skipping non-speech text: "${text}"`);
      onCompleteRef.current?.();
      return;
    }

    const audio = getOrCreateAudio();
    audio.pause();
    stoppedRef.current = false;
    retryCountRef.current = 0;
    setIsLoading(true);
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);

    try {
      const key = cacheKey || text;
      console.log(`[TTS] fetching audio for: "${text.slice(0, 40)}..."`);
      const uri = await fetchAudio(text, key);
      if (stoppedRef.current) return;
      if (!uri) {
        console.warn('[TTS] no audio returned, skipping to next');
        setIsLoading(false);
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }
      console.log(`[TTS] got URI, starting playback`);
      playAudioUri(uri);
    } catch (err: unknown) {
      if (stoppedRef.current) return;
      const msg = err instanceof Error ? err.message : 'TTS failed';
      console.error('[TTS] play error:', msg);
      setIsLoading(false);
      setIsPlaying(false);
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, [getOrCreateAudio, fetchAudio, playAudioUri]);

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
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, []);

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
