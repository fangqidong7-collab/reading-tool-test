'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Speed options: speechRate for Coze TTS API, playbackRate for Web Audio
export const SPEED_OPTIONS = [
  { label: '0.75x', speechRate: -15, playbackRate: 0.75 },
  { label: '1.0x', speechRate: 0, playbackRate: 1.0 },
  { label: '1.25x', speechRate: 15, playbackRate: 1.25 },
  { label: '1.5x', speechRate: 30, playbackRate: 1.5 },
  { label: '2.0x', speechRate: 50, playbackRate: 2.0 },
];
const DEFAULT_SPEED_INDEX = 1;

export interface Sentence {
  id: string;
  text: string;
  startChar: number;
  endChar: number;
  paragraphIndex: number;
}

/** Split text into sentences for TTS (English + Chinese punctuation) */
export function splitIntoSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  const regex = /([.!?。！？]+[\s\n]*)|(\n+)/;
  let lastIndex = 0;
  let id = 0;

  const parts = text.split(regex);
  for (const part of parts) {
    if (!part || /^\s*$/.test(part)) {
      lastIndex += part?.length ?? 0;
      continue;
    }
    const trimmed = part.trim();
    if (!trimmed) { lastIndex += part.length; continue; }
    sentences.push({
      id: `s-${id++}`,
      text: trimmed,
      startChar: lastIndex,
      endChar: lastIndex + part.length,
      paragraphIndex: 0,
    });
    lastIndex += part.length;
  }
  return sentences;
}

/** Find the sentence index at a given character offset */
export function findSentenceAtChar(sentences: Sentence[], charIndex: number): number {
  for (let i = 0; i < sentences.length; i++) {
    if (charIndex >= sentences[i].startChar && charIndex <= sentences[i].endChar) return i;
    if (charIndex < sentences[i].startChar) return Math.max(0, i - 1);
  }
  return sentences.length - 1;
}

interface UseTTSOptions {
  onSentenceChange?: (sentenceId: string) => void;
  onComplete?: () => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const { onSentenceChange, onComplete } = options;

  const [state, setState] = useState({
    isPlaying: false,
    isPaused: false,
    currentSentenceIndex: -1,
    speedIndex: DEFAULT_SPEED_INDEX,
    isLoading: false,
    error: null as string | null,
  });

  // Refs (avoid stale closures)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sentencesRef = useRef<Sentence[]>([]);
  const audioCache = useRef<Map<string, string>>(new Map());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const currentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const onSentenceChangeRef = useRef(onSentenceChange);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onSentenceChangeRef.current = onSentenceChange; }, [onSentenceChange]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Keep speed in ref for closures
  const speedIndexRef = useRef(DEFAULT_SPEED_INDEX);
  const getSpeed = () => SPEED_OPTIONS[speedIndexRef.current];

  /** Initialize AudioContext lazily */
  const initAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /** Internal stop (no state reset) */
  const doStop = useCallback(() => {
    isStoppedRef.current = true;
    isPlayingRef.current = false;
    isPausedRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    currentIndexRef.current = -1;
  }, []);

  /** Reset state after stop */
  const resetState = useCallback(() => {
    setState((s) => ({
      ...s,
      isPlaying: false,
      isPaused: false,
      currentSentenceIndex: -1,
      isLoading: false,
      error: null,
    }));
  }, []);

  /** Public stop */
  const stop = useCallback(() => {
    doStop();
    resetState();
  }, [doStop, resetState]);

  /** Play audio URL at given sentence index */
  const playAudio = useCallback(
    async (audioUri: string, sentenceIndex: number) => {
      if (isStoppedRef.current) return;

      const speed = getSpeed();

      try {
        setState((s) => ({ ...s, isLoading: false, error: null }));

        // Cleanup previous audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        const audio = new Audio(audioUri);
        audio.preload = 'auto';
        audio.playbackRate = speed.playbackRate;
        audioRef.current = audio;

        // Setup AudioContext for playback rate control
        const ctx = await initAudioCtx();
        if (sourceRef.current) {
          try { sourceRef.current.disconnect(); } catch (_) {}
        }
        sourceRef.current = ctx.createMediaElementSource(audio);
        sourceRef.current.connect(ctx.destination);

        // Update state
        currentIndexRef.current = sentenceIndex;
        isPlayingRef.current = true;
        isPausedRef.current = false;

        const sentence = sentencesRef.current[sentenceIndex];
        setState((s) => ({
          ...s,
          isLoading: false,
          isPlaying: true,
          isPaused: false,
          currentSentenceIndex: sentenceIndex,
        }));
        onSentenceChangeRef.current?.(sentence?.id ?? '');

        await audio.play();

        audio.onended = () => {
          if (!isPlayingRef.current || isStoppedRef.current) return;
          playNext(sentenceIndex + 1);
        };
        audio.onerror = () => {
          if (isStoppedRef.current) return;
          playNext(sentenceIndex + 1);
        };
      } catch (err: any) {
        console.error('[TTS] Play error:', err);
        if (isStoppedRef.current) return;
        setState((s) => ({ ...s, isLoading: false, error: err?.message ?? 'Playback failed' }));
        playNext(sentenceIndex + 1);
      }
    },
    [initAudioCtx] // getSpeed via ref
  );

  /** Play next sentence */
  const playNext = useCallback(
    async (nextIndex: number) => {
      if (isStoppedRef.current) return;

      const sentences = sentencesRef.current;
      if (nextIndex >= sentences.length) {
        doStop();
        resetState();
        setState((s) => ({ ...s, currentSentenceIndex: -1 }));
        onCompleteRef.current?.();
        return;
      }

      const sentence = sentences[nextIndex];

      // From cache
      const cached = audioCache.current.get(sentence.id);
      if (cached) {
        await playAudio(cached, nextIndex);
        prefetch(nextIndex + 1, 3);
        return;
      }

      // Fetch
      try {
        setState((s) => ({ ...s, isLoading: true }));
        const speed = getSpeed();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sentence.text, speechRate: speed.speechRate }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? 'TTS failed');
        }

        const data = await res.json();
        audioCache.current.set(sentence.id, data.audioUri);
        prefetchedRef.current.add(sentence.id);

        await playAudio(data.audioUri, nextIndex);
        prefetch(nextIndex + 1, 3);
      } catch (err: any) {
        console.error('[TTS] Fetch error:', err);
        if (isStoppedRef.current) return;
        setState((s) => ({ ...s, isLoading: false, error: err?.message ?? 'TTS fetch failed' }));
        playNext(nextIndex + 1);
      }
    },
    [doStop, playAudio, resetState]
  );

  /** Pre-fetch upcoming sentences */
  const prefetch = useCallback(
    async (fromIndex: number, count: number = 3) => {
      const sentences = sentencesRef.current;
      const speed = getSpeed();
      for (let i = fromIndex; i < fromIndex + count && i < sentences.length; i++) {
        const s = sentences[i];
        if (prefetchedRef.current.has(s.id)) continue;
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: s.text, speechRate: speed.speechRate }),
          });
          if (res.ok) {
            const data = await res.json();
            audioCache.current.set(s.id, data.audioUri);
            prefetchedRef.current.add(s.id);
          }
        } catch (_) {}
      }
    },
    []
  );

  /** Start TTS from text, optionally at character offset */
  const start = useCallback(
    async (text: string, startCharOffset: number = 0) => {
      // Stop previous
      doStop();
      isStoppedRef.current = false;

      const sentences = splitIntoSentences(text);
      if (sentences.length === 0) return;

      sentencesRef.current = sentences;
      audioCache.current.clear();
      prefetchedRef.current.clear();

      let startIndex = findSentenceAtChar(sentences, startCharOffset);
      startIndex = Math.max(0, startIndex);

      await prefetch(startIndex, 2);
      await playNext(startIndex);
    },
    [doStop, playNext, prefetch]
  );

  /** Pause */
  const pause = useCallback(() => {
    if (!audioRef.current || isPausedRef.current) return;
    audioRef.current.pause();
    isPausedRef.current = true;
    isPlayingRef.current = false;
    setState((s) => ({ ...s, isPlaying: false, isPaused: true }));
  }, []);

  /** Resume */
  const resume = useCallback(async () => {
    if (!audioRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    isPlayingRef.current = true;
    setState((s) => ({ ...s, isPlaying: true, isPaused: false }));
    await audioRef.current.play();
  }, []);

  /** Change speed */
  const setSpeed = useCallback((speedIndex: number) => {
    const s = SPEED_OPTIONS[speedIndex];
    if (!s) return;
    speedIndexRef.current = speedIndex;
    setState((prev) => ({ ...prev, speedIndex }));
    if (audioRef.current) {
      audioRef.current.playbackRate = s.playbackRate;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      doStop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [doStop]);

  return {
    ...state,
    currentSentenceId:
      state.currentSentenceIndex >= 0
        ? sentencesRef.current[state.currentSentenceIndex]?.id ?? null
        : null,
    sentenceCount: sentencesRef.current.length,
    start,
    stop,
    pause,
    resume,
    setSpeed,
  };
}
