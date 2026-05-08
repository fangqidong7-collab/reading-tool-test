'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export const SPEED_OPTIONS = [
  { label: '0.75x', rate: 0.75 },
  { label: '1.0x', rate: 1.0 },
  { label: '1.25x', rate: 1.25 },
  { label: '1.5x', rate: 1.5 },
  { label: '2.0x', rate: 2.0 },
];

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

interface UseTTSOptions {
  onComplete?: () => void;
  onError?: (msg: string) => void;
}

function detectLocalTTS(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function useTTS(options: UseTTSOptions = {}) {
  const { onComplete, onError } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [useLocalTTS, setUseLocalTTS] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const stoppedRef = useRef(false);
  const speedIndexRef = useRef(1);
  const retryCountRef = useRef(0);
  const playSeqRef = useRef(0);
  const useLocalRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const audioCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const local = detectLocalTTS();
    useLocalRef.current = local;
    setUseLocalTTS(local);
    if (local) {
      console.log('[TTS] using local Web Speech API');
    } else {
      console.log('[TTS] Web Speech API unavailable, using remote Coze API');
    }
  }, []);

  // ─── Local Speech Synthesis ───

  const stopLocalSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    utterRef.current = null;
  }, []);

  const playLocal = useCallback((text: string) => {
    const seq = ++playSeqRef.current;
    stoppedRef.current = false;
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);
    setIsLoading(false);

    const synth = window.speechSynthesis;
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = SPEED_OPTIONS[speedIndexRef.current]?.rate ?? 1.0;

    const voices = synth.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.localService)
      || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utter.voice = enVoice;

    utter.onend = () => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
      console.log('[TTS-local] sentence ended');
      setIsPlaying(false);
      setIsPaused(false);
      onCompleteRef.current?.();
    };
    utter.onerror = (e) => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('[TTS-local] error:', e.error);
      setIsPlaying(false);
      setError(`Speech error: ${e.error}`);
      onErrorRef.current?.(`Speech error: ${e.error}`);
    };

    utterRef.current = utter;
    synth.speak(utter);
    console.log(`[TTS-local] speaking: "${text.slice(0, 40)}..."`);
  }, []);

  // ─── Remote Audio (Coze API fallback) ───

  const getOrCreateAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return audio;
  }, []);

  const fetchAudio = useCallback(async (text: string, cacheKey: string): Promise<string | null> => {
    const cached = audioCacheRef.current.get(cacheKey);
    if (cached) return cached;
    try {
      const speed = SPEED_OPTIONS[speedIndexRef.current];
      const speechRate = Math.round((speed.rate - 1) * 50);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speechRate }),
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
    audio.playbackRate = speed?.rate ?? 1.0;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        if (seq !== playSeqRef.current) return;
        setIsLoading(false);
        setIsPlaying(true);
      }).catch((e) => {
        if (stoppedRef.current || seq !== playSeqRef.current) return;
        console.warn(`[TTS-remote] play() rejected: ${e?.message}`);
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          setTimeout(() => attemptPlay(audio, seq), RETRY_DELAY_MS * retryCountRef.current);
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
      console.log('[TTS-remote] sentence ended');
      retryCountRef.current = 0;
      setIsPlaying(false);
      setIsPaused(false);
      onCompleteRef.current?.();
    };
    audio.onerror = () => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setTimeout(() => {
          if (stoppedRef.current || seq !== playSeqRef.current) return;
          audio.src = uri;
          audio.load();
          attemptPlay(audio, seq);
        }, RETRY_DELAY_MS * retryCountRef.current);
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

  const playRemote = useCallback(async (text: string, cacheKey?: string) => {
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
      console.log(`[TTS-remote] fetching audio for: "${text.slice(0, 40)}..."`);
      const uri = await fetchAudio(text, key);
      if (stoppedRef.current) return;
      if (!uri) {
        console.warn('[TTS-remote] no audio returned, skipping');
        setIsLoading(false);
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }
      playAudioUri(uri);
    } catch (err: unknown) {
      if (stoppedRef.current) return;
      const msg = err instanceof Error ? err.message : 'TTS failed';
      console.error('[TTS-remote] error:', msg);
      setIsLoading(false);
      setIsPlaying(false);
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, [getOrCreateAudio, fetchAudio, playAudioUri]);

  // ─── Unified interface ───

  const play = useCallback(async (text: string, cacheKey?: string) => {
    if (!/[a-zA-Z0-9\u4e00-\u9fff]/.test(text)) {
      console.log(`[TTS] skipping non-speech text: "${text}"`);
      onCompleteRef.current?.();
      return;
    }
    if (useLocalRef.current) {
      playLocal(text);
    } else {
      await playRemote(text, cacheKey);
    }
  }, [playLocal, playRemote]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    retryCountRef.current = 0;
    playSeqRef.current += 1;
    stopLocalSpeech();
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
  }, [stopLocalSpeech]);

  const pause = useCallback(() => {
    if (useLocalRef.current) {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
    } else if (audioRef.current && !isPaused) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPaused]);

  const resume = useCallback(async () => {
    if (useLocalRef.current) {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsPlaying(true);
      }
    } else if (audioRef.current && isPaused) {
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
    if (useLocalRef.current) {
      if (utterRef.current) utterRef.current.rate = opt.rate;
    } else if (audioRef.current) {
      audioRef.current.playbackRate = opt.rate;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopLocalSpeech();
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, [stopLocalSpeech]);

  return {
    isPlaying,
    isPaused,
    isLoading,
    speedIndex,
    error,
    useLocalTTS,
    play,
    playAudioUri,
    fetchAudio,
    stop,
    pause,
    resume,
    setSpeed,
  };
}
