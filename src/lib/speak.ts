/**
 * 朗读英文单词发音
 * 优先使用有道词典真人发音，失败后回退到浏览器 TTS
 */
let currentAudio: HTMLAudioElement | null = null;

export function speakWord(word: string) {
  try {
    // 停止上一次播放
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;
    const audio = new Audio(url);
    currentAudio = audio;

    audio.play().catch(() => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    });
  } catch (e) {
    console.warn("发音失败:", e);
  }
}
