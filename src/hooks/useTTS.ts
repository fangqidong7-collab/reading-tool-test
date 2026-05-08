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

export interface TTSVoiceInfo {
  name: string;
  lang: string;
  index: number;
}

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
  const [voices, setVoices] = useState<TTSVoiceInfo[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const stoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const speedIndexRef = useRef(1);
  const voiceIndexRef = useRef(0);
  const retryCountRef = useRef(0);
  const playSeqRef = useRef(0);
  const useLocalRef = useRef(false);
  const rawVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const loadVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const all = synth.getVoices();
    const enVoices = all.filter(v => v.lang.startsWith('en'));
    if (enVoices.length === 0) return;

    rawVoicesRef.current = enVoices;
    const mapped: TTSVoiceInfo[] = enVoices.map((v, i) => ({
      name: v.name,
      lang: v.lang,
      index: i,
    }));
    setVoices(mapped);

    const saved = localStorage.getItem('tts-voice-name');
    if (saved) {
      const idx = enVoices.findIndex(v => v.name === saved);
      if (idx >= 0) {
        voiceIndexRef.current = idx;
        setVoiceIndex(idx);
        return;
      }
    }
    const defaultIdx = enVoices.findIndex(v => v.localService) || 0;
    voiceIndexRef.current = defaultIdx >= 0 ? defaultIdx : 0;
    setVoiceIndex(voiceIndexRef.current);
  }, []);

  useEffect(() => {
    const hasLocal = detectLocalTTS();
    const saved = typeof window !== 'undefined' ? localStorage.getItem('tts-source') : null;
    const preferLocal = saved === null ? hasLocal : saved === 'local';
    useLocalRef.current = preferLocal && hasLocal;
    setUseLocalTTS(preferLocal && hasLocal);
    if (hasLocal) {
      loadVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadVoices]);

  const hasLocalTTS = typeof window !== 'undefined' && detectLocalTTS();

  const setTTSSource = useCallback((useLocal: boolean) => {
    const val = useLocal && detectLocalTTS();
    useLocalRef.current = val;
    setUseLocalTTS(val);
    localStorage.setItem('tts-source', useLocal ? 'local' : 'remote');
  }, []);

  const selectVoice = useCallback((index: number) => {
    const v = rawVoicesRef.current[index];
    if (!v) return;
    voiceIndexRef.current = index;
    setVoiceIndex(index);
    localStorage.setItem('tts-voice-name', v.name);
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

    const selectedVoice = rawVoicesRef.current[voiceIndexRef.current];
    if (selectedVoice) utter.voice = selectedVoice;

    utter.onend = () => {
      if (stoppedRef.current || seq !== playSeqRef.current) return;
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
  }, []);

  // ─── Remote Audio (Coze API fallback) ───

  const getOrCreateAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    return audio;
  }, []);

  const fetchAudioEdge = useCallback(async (text: string, rate: number): Promise<string | null> => {
    try {
      const res = await fetch('/api/tts-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rate }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size === 0) return null;
      return URL.createObjectURL(blob);
    } catch { return null; }
  }, []);

  const fetchAudioCoze = useCallback(async (text: string, speechRate: number): Promise<string | null> => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speechRate }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.audioUri || null;
    } catch { return null; }
  }, []);

  const fetchAudio = useCallback(async (text: string, cacheKey: string): Promise<string | null> => {
    const cached = audioCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const speed = SPEED_OPTIONS[speedIndexRef.current];
    const ratePercent = Math.round((speed.rate - 1) * 100);

    const uri = await fetchAudioEdge(text, ratePercent);
    if (uri) {
      audioCacheRef.current.set(cacheKey, uri);
      return uri;
    }

    console.warn('[TTS] Edge TTS failed, falling back to Coze API');
    const speechRate = Math.round((speed.rate - 1) * 50);
    const cozeUri = await fetchAudioCoze(text, speechRate);
    if (cozeUri) {
      audioCacheRef.current.set(cacheKey, cozeUri);
      return cozeUri;
    }

    return null;
  }, [fetchAudioEdge, fetchAudioCoze]);

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
      const uri = await fetchAudio(text, key);
      if (stoppedRef.current) return;
      if (!uri) {
        setIsLoading(false);
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }
      playAudioUri(uri);
    } catch (err: unknown) {
      if (stoppedRef.current) return;
      const msg = err instanceof Error ? err.message : 'TTS failed';
      setIsLoading(false);
      setIsPlaying(false);
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, [getOrCreateAudio, fetchAudio, playAudioUri]);

  // ─── Unified interface ───

  const play = useCallback(async (text: string, cacheKey?: string) => {
    if (!/[a-zA-Z0-9\u4e00-\u9fff]/.test(text)) {
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
    isPausedRef.current = false;
    setIsPaused(false);
    setIsLoading(false);
    setError(null);
  }, [stopLocalSpeech]);

  const pause = useCallback(() => {
    if (useLocalRef.current) {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        isPausedRef.current = true;
        setIsPaused(true);
        setIsPlaying(false);
      }
    } else if (audioRef.current && !isPausedRef.current) {
      audioRef.current.pause();
      isPausedRef.current = true;
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(async () => {
    if (useLocalRef.current) {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        isPausedRef.current = false;
        setIsPaused(false);
        setIsPlaying(true);
      }
    } else if (audioRef.current && isPausedRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
      setIsPlaying(true);
      await audioRef.current.play();
    }
  }, []);

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
    hasLocalTTS,
    setTTSSource,
    voices,
    voiceIndex,
    selectVoice,
    play,
    playAudioUri,
    fetchAudio,
    stop,
    pause,
    resume,
    setSpeed,
  };
}
