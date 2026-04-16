"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";

interface VocabItem {
  root: string;
  meaning: string;
  pos: string;
  correctCount: number;
}

interface VocabularyQuizProps {
  vocabulary: Record<string, VocabItem>;
  onCorrect: (root: string) => void;
  onClose: () => void;
}

type QuizCard = {
  word: string;
  correctMeaning: string;
  options: string[];
};

// 随机打乱数组
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 计算两个单词的"形近度"分数（0~1，越高越像）
 * 基于编辑距离（Levenshtein Distance）
 */
function wordSimilarity(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;

  const lenA = la.length;
  const lenB = lb.length;
  const maxLen = Math.max(lenA, lenB);
  if (maxLen === 0) return 1;

  // 标准编辑距离 DP
  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array(lenB + 1).fill(0)
  );
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const editDist = dp[lenA][lenB];
  return 1 - editDist / maxLen;
}

/**
 * 判断一个释义是否为中文（包含中文字符）
 */
function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function VocabularyQuiz({ vocabulary, onCorrect, onClose }: VocabularyQuizProps) {
  const vocabList = useMemo(() => Object.values(vocabulary), [vocabulary]);

  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [quizCount, setQuizCount] = useState(10);
  const [cards, setCards] = useState<QuizCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [wrongTotal, setWrongTotal] = useState(0);
  const [wrongWords, setWrongWords] = useState<string[]>([]);

  const generateCards = useCallback(() => {
    const count = Math.min(quizCount, vocabList.length);
    const selected = shuffle(vocabList).slice(0, count);

    // 预先把词汇按中/英释义分成两个池子
    const chinesePool = vocabList.filter((v) => isChinese(v.meaning));
    const englishPool = vocabList.filter((v) => !isChinese(v.meaning));

    const generatedCards: QuizCard[] = selected.map((item) => {
      const isZh = isChinese(item.meaning);
      // 选同语言池作为候选干扰项来源
      const sameLanguagePool = isZh ? chinesePool : englishPool;

      // 从同语言池中找出除自己之外、且释义不同的词
      const otherWords = sameLanguagePool.filter(
        (v) => v.root !== item.root && v.meaning !== item.meaning
      );

      let wrongMeanings: string[] = [];

      if (otherWords.length >= 3) {
        // 按单词拼写相似度排序，优先选"形近词"的释义作为干扰项
        const scoredWords = otherWords.map((v) => ({
          meaning: v.meaning,
          similarity: wordSimilarity(item.root, v.root),
        }));

        // 按相似度从高到低排序，取前 6 个候选，再从中随机选 3 个
        // 加一点随机性，不要每次都是固定的前3个
        scoredWords.sort((a, b) => b.similarity - a.similarity);
        const topCandidates = scoredWords.slice(
          0,
          Math.min(6, scoredWords.length)
        );
        wrongMeanings = shuffle(topCandidates)
          .slice(0, 3)
          .map((v) => v.meaning);

        // 如果形近词不够 3 个，从剩余词中随机补
        if (wrongMeanings.length < 3) {
          const remaining = scoredWords
            .slice(topCandidates.length)
            .map((v) => v.meaning)
            .filter((m) => !wrongMeanings.includes(m));
          wrongMeanings.push(
            ...shuffle(remaining).slice(0, 3 - wrongMeanings.length)
          );
        }
      } else {
        // 同语言池不够 3 个，退化为从全部词汇中选
        const fallback = vocabList.filter(
          (v) => v.root !== item.root && v.meaning !== item.meaning
        );
        wrongMeanings = shuffle(fallback)
          .slice(0, 3)
          .map((v) => v.meaning);
      }

      // 去重：确保 wrongMeanings 中没有跟正确答案重复的
      wrongMeanings = wrongMeanings.filter((m) => m !== item.meaning);
      // 如果去重后不够 3 个，再补
      if (wrongMeanings.length < 3) {
        const allOther = vocabList
          .filter(
            (v) =>
              v.root !== item.root &&
              v.meaning !== item.meaning &&
              !wrongMeanings.includes(v.meaning)
          )
          .map((v) => v.meaning);
        wrongMeanings.push(
          ...shuffle(allOther).slice(0, 3 - wrongMeanings.length)
        );
      }

      const options = shuffle([item.meaning, ...wrongMeanings.slice(0, 3)]);
      return {
        word: item.root,
        correctMeaning: item.meaning,
        options,
      };
    });

    setCards(generatedCards);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsCorrect(null);
    setCorrectTotal(0);
    setWrongTotal(0);
    setWrongWords([]);
    setPhase("quiz");
  }, [vocabList, quizCount]);

  const handleSelect = useCallback(
    (option: string) => {
      if (selectedOption !== null) return;
      const card = cards[currentIndex];
      const correct = option === card.correctMeaning;
      setSelectedOption(option);
      setIsCorrect(correct);

      if (correct) {
        setCorrectTotal((c) => c + 1);
        onCorrect(card.word);
      } else {
        setWrongTotal((w) => w + 1);
        setWrongWords((prev) => [...prev, card.word]);
      }
    },
    [selectedOption, cards, currentIndex, onCorrect]
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= cards.length) {
      setPhase("result");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsCorrect(null);
    }
  }, [currentIndex, cards.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === "quiz" && selectedOption !== null && e.key === "Enter") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, selectedOption, handleNext]);

  const card =
    phase === "quiz" && cards[currentIndex] ? cards[currentIndex] : null;

  return (
    <>
      {/* ===== Setup Phase ===== */}
      {phase === "setup" && (
        <div className="quiz-overlay" onClick={onClose}>
          <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="quiz-title">单词 Quiz</h2>
            <p className="quiz-subtitle">
              词汇表共 <strong>{vocabList.length}</strong>{" "}
              个单词，选择要复习的数量：
            </p>
            <div className="quiz-count-input">
              <input
                type="number"
                min={1}
                max={vocabList.length}
                value={quizCount}
                onChange={(e) =>
                  setQuizCount(
                    Math.max(
                      1,
                      Math.min(
                        vocabList.length,
                        parseInt(e.target.value) || 1
                      )
                    )
                  )
                }
              />
              <span>个</span>
            </div>
            <div className="quiz-quick-btns">
              {[5, 10, 20, 50].map(
                (n) =>
                  n <= vocabList.length && (
                    <button
                      key={n}
                      onClick={() => setQuizCount(n)}
                      className={quizCount === n ? "active" : ""}
                    >
                      {n}
                    </button>
                  )
              )}
              {vocabList.length > 0 && (
                <button
                  onClick={() => setQuizCount(vocabList.length)}
                  className={
                    quizCount === vocabList.length ? "active" : ""
                  }
                >
                  全部
                </button>
              )}
            </div>
            <div className="quiz-actions">
              <button className="quiz-cancel-btn" onClick={onClose}>
                取消
              </button>
              <button
                className="quiz-start-btn"
                onClick={generateCards}
                disabled={vocabList.length < 4}
              >
                开始 Quiz
              </button>
            </div>
            {vocabList.length < 4 && (
              <p className="quiz-warning">
                词汇表至少需要 4 个单词才能生成选项
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== Quiz Phase ===== */}
      {phase === "quiz" && card && (
        <div className="quiz-overlay" onClick={onClose}>
          <div
            className="quiz-modal quiz-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quiz-progress-bar">
              <div
                className="quiz-progress-fill"
                style={{
                  width: `${((currentIndex + 1) / cards.length) * 100}%`,
                }}
              />
            </div>
            <div className="quiz-progress-text">
              {currentIndex + 1} / {cards.length}
            </div>

            <div className="quiz-word-card">
              <span className="quiz-word">{card.word}</span>
            </div>

            <div className="quiz-options">
              {card.options.map((opt, idx) => {
                let optionClass = "quiz-option";
                if (selectedOption !== null) {
                  if (opt === card.correctMeaning) {
                    optionClass += " correct";
                  } else if (opt === selectedOption && !isCorrect) {
                    optionClass += " wrong";
                  }
                }
                return (
                  <button
                    key={idx}
                    className={optionClass}
                    onClick={() => handleSelect(opt)}
                    disabled={selectedOption !== null}
                  >
                    <span className="option-label">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="option-text">{opt}</span>
                  </button>
                );
              })}
            </div>

            {selectedOption !== null && (
              <div className="quiz-feedback">
                <span
                  className={
                    isCorrect ? "feedback-correct" : "feedback-wrong"
                  }
                >
                  {isCorrect
                    ? "正确!"
                    : `错误! 正确答案: ${card.correctMeaning}`}
                </span>
                <button className="quiz-next-btn" onClick={handleNext}>
                  {currentIndex + 1 >= cards.length
                    ? "查看结果"
                    : "下一题 →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Result Phase ===== */}
      {phase === "result" && (
        <div className="quiz-overlay" onClick={onClose}>
          <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="quiz-title">Quiz 完成!</h2>
            <div className="quiz-result-stats">
              <div className="result-stat correct-stat">
                <span className="result-number">{correctTotal}</span>
                <span className="result-label">答对</span>
              </div>
              <div className="result-stat wrong-stat">
                <span className="result-number">{wrongTotal}</span>
                <span className="result-label">答错</span>
              </div>
              <div className="result-stat rate-stat">
                <span className="result-number">
                  {cards.length > 0
                    ? Math.round((correctTotal / cards.length) * 100)
                    : 0}
                  %
                </span>
                <span className="result-label">正确率</span>
              </div>
            </div>

            {wrongWords.length > 0 && (
              <div className="quiz-wrong-list">
                <p className="wrong-list-title">需要加强的单词：</p>
                <div className="wrong-words">
                  {wrongWords.map((w) => (
                    <span key={w} className="wrong-word-tag">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="quiz-actions">
              <button className="quiz-cancel-btn" onClick={onClose}>
                关闭
              </button>
              <button
                className="quiz-start-btn"
                onClick={() => setPhase("setup")}
              >
                再来一轮
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Unified Styles ===== */}
      <style jsx>{`
        .quiz-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 20px;
        }

        .quiz-modal {
          background: white;
          border-radius: 16px;
          padding: 28px 24px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
          max-height: 90vh;
          overflow-y: auto;
        }

        .quiz-card-modal {
          padding: 20px 24px;
        }

        .quiz-title {
          font-size: 22px;
          font-weight: 700;
          color: #333;
          margin: 0 0 8px;
          text-align: center;
        }

        .quiz-subtitle {
          font-size: 14px;
          color: #666;
          text-align: center;
          margin: 0 0 20px;
        }

        .quiz-count-input {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .quiz-count-input input {
          width: 80px;
          padding: 8px 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          text-align: center;
          outline: none;
          transition: border-color 0.15s;
        }

        .quiz-count-input input:focus {
          border-color: #4a90d9;
        }

        .quiz-count-input span {
          font-size: 15px;
          color: #666;
        }

        .quiz-quick-btns {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .quiz-quick-btns button {
          padding: 6px 16px;
          border: 1px solid #ddd;
          border-radius: 20px;
          background: white;
          font-size: 13px;
          color: #666;
          cursor: pointer;
          transition: all 0.15s;
        }

        .quiz-quick-btns button:hover {
          border-color: #4a90d9;
          color: #4a90d9;
        }

        .quiz-quick-btns button.active {
          background: #4a90d9;
          color: white;
          border-color: #4a90d9;
        }

        .quiz-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .quiz-cancel-btn {
          flex: 1;
          padding: 12px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 10px;
          font-size: 15px;
          color: #666;
          cursor: pointer;
        }

        .quiz-cancel-btn:hover {
          background: #e8e8e8;
        }

        .quiz-start-btn {
          flex: 1;
          padding: 12px;
          background: #4a90d9;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .quiz-start-btn:hover {
          background: #3a7bc8;
        }

        .quiz-start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quiz-warning {
          font-size: 12px;
          color: #e74c3c;
          text-align: center;
          margin-top: 8px;
        }

        .quiz-progress-bar {
          height: 4px;
          background: #eee;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 6px;
        }

        .quiz-progress-fill {
          height: 100%;
          background: #4a90d9;
          transition: width 0.3s ease;
        }

        .quiz-progress-text {
          font-size: 12px;
          color: #999;
          text-align: right;
          margin-bottom: 16px;
        }

        .quiz-word-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 14px;
          padding: 36px 20px;
          text-align: center;
          margin-bottom: 20px;
        }

        .quiz-word {
          font-size: 32px;
          font-weight: 700;
          color: white;
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: 1px;
        }

        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        .quiz-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }

        .quiz-option:hover:not(:disabled) {
          border-color: #4a90d9;
          background: rgba(74, 144, 217, 0.04);
        }

        .quiz-option.correct {
          border-color: #27ae60;
          background: rgba(39, 174, 96, 0.08);
        }

        .quiz-option.wrong {
          border-color: #e74c3c;
          background: rgba(231, 76, 60, 0.08);
        }

        .option-label {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          color: #666;
          flex-shrink: 0;
        }

        .quiz-option.correct .option-label {
          background: #27ae60;
          color: white;
        }

        .quiz-option.wrong .option-label {
          background: #e74c3c;
          color: white;
        }

        .option-text {
          font-size: 15px;
          color: #333;
          line-height: 1.4;
        }

        .quiz-feedback {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .feedback-correct {
          color: #27ae60;
          font-weight: 600;
          font-size: 15px;
        }

        .feedback-wrong {
          color: #e74c3c;
          font-weight: 500;
          font-size: 13px;
          flex: 1;
        }

        .quiz-next-btn {
          padding: 10px 20px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .quiz-next-btn:hover {
          background: #3a7bc8;
        }

        .quiz-result-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin: 24px 0;
        }

        .result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .result-number {
          font-size: 32px;
          font-weight: 700;
        }

        .correct-stat .result-number {
          color: #27ae60;
        }

        .wrong-stat .result-number {
          color: #e74c3c;
        }

        .rate-stat .result-number {
          color: #4a90d9;
        }

        .result-label {
          font-size: 13px;
          color: #999;
        }

        .quiz-wrong-list {
          background: #fff5f5;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 20px;
        }

        .wrong-list-title {
          font-size: 13px;
          color: #e74c3c;
          margin: 0 0 8px;
          font-weight: 500;
        }

        .wrong-words {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .wrong-word-tag {
          padding: 4px 10px;
          background: white;
          border: 1px solid #f0c0c0;
          border-radius: 6px;
          font-size: 13px;
          color: #c0392b;
          font-family: Georgia, serif;
        }

        @media (max-width: 768px) {
          .quiz-modal {
            padding: 20px 16px;
            margin: 10px;
          }
          .quiz-word {
            font-size: 26px;
          }
          .quiz-word-card {
            padding: 28px 16px;
          }
        }
      `}</style>
    </>
  );
}
