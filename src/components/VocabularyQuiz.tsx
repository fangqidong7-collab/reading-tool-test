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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function VocabularyQuiz({
  vocabulary,
  onCorrect,
  onClose,
}: VocabularyQuizProps) {
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

    const chinesePool = vocabList.filter((v) => isChinese(v.meaning));
    const englishPool = vocabList.filter((v) => !isChinese(v.meaning));

    const generatedCards: QuizCard[] = selected.map((item) => {
      const isZh = isChinese(item.meaning);
      const sameLanguagePool = isZh ? chinesePool : englishPool;

      // 从同语言池中随机选 3 个不同释义作为干扰项
      const otherMeanings = shuffle(
        sameLanguagePool.filter(
          (v) => v.root !== item.root && v.meaning !== item.meaning
        )
      )
        .slice(0, 3)
        .map((v) => v.meaning);

      let wrongMeanings = [...otherMeanings];

      // 如果同语言池不够 3 个，从全部词汇中补
      if (wrongMeanings.length < 3) {
        const fallback = vocabList.filter(
          (v) =>
            v.root !== item.root &&
            v.meaning !== item.meaning &&
            !wrongMeanings.includes(v.meaning)
        );
        wrongMeanings.push(
          ...shuffle(fallback)
            .slice(0, 3 - wrongMeanings.length)
            .map((v) => v.meaning)
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

  const handleQuit = useCallback(() => {
    setPhase("result");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === "quiz" && selectedOption !== null && e.key === "Enter") {
        handleNext();
      }
      if (phase === "quiz" && e.key === "Escape") {
        handleQuit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, selectedOption, handleNext, handleQuit]);

  const card =
    phase === "quiz" && cards[currentIndex] ? cards[currentIndex] : null;

  const answeredCount = correctTotal + wrongTotal;
  const accuracy =
    answeredCount > 0 ? Math.round((correctTotal / answeredCount) * 100) : 0;

  return (
    <>
      {/* ===== Setup Phase ===== */}
      {phase === "setup" && (
        <div className="quiz-overlay" onClick={onClose}>
          <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="quiz-title">单词 Quiz</h2>
            <p className="quiz-subtitle">
              词汇表共 <strong>{vocabList.length}</strong> 个单词，选择要复习的数量：
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
                      Math.min(vocabList.length, parseInt(e.target.value) || 1)
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
                  className={quizCount === vocabList.length ? "active" : ""}
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
        <div className="quiz-overlay">
          <div
            className="quiz-modal quiz-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar: progress + quit */}
            <div className="quiz-top-bar">
              <div className="quiz-progress-bar">
                <div
                  className="quiz-progress-fill"
                  style={{
                    width: `${((currentIndex + 1) / cards.length) * 100}%`,
                  }}
                />
              </div>
              <div className="quiz-top-row">
                <span className="quiz-progress-text">
                  {currentIndex + 1} / {cards.length}
                </span>
                <button className="quiz-quit-btn" onClick={handleQuit}>
                  退出
                </button>
              </div>
            </div>

            {/* Word card */}
            <div className="quiz-word-card">
              <span className="quiz-word">{card.word}</span>
            </div>

            {/* Options */}
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

            {/* Feedback */}
            {selectedOption !== null && (
              <div className="quiz-feedback">
                <span
                  className={isCorrect ? "feedback-correct" : "feedback-wrong"}
                >
                  {isCorrect
                    ? "正确!"
                    : `错误! 正确答案: ${card.correctMeaning}`}
                </span>
                <button className="quiz-next-btn" onClick={handleNext}>
                  {currentIndex + 1 >= cards.length ? "查看结果" : "下一题 →"}
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
                <span className="result-number">{accuracy}%</span>
                <span className="result-label">正确率</span>
              </div>
            </div>

            {answeredCount < cards.length && (
              <p className="quiz-quit-note">
                已提前退出，完成了 {answeredCount}/{cards.length} 题
              </p>
            )}

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
          padding: 12px;
        }

        .quiz-modal {
          background: white;
          border-radius: 16px;
          padding: 24px 20px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
          max-height: 95vh;
          overflow-y: auto;
        }

        .quiz-card-modal {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
        }

        .quiz-title {
          font-size: 20px;
          font-weight: 700;
          color: #333;
          margin: 0 0 6px;
          text-align: center;
        }

        .quiz-subtitle {
          font-size: 14px;
          color: #666;
          text-align: center;
          margin: 0 0 16px;
        }

        .quiz-count-input {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
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
          margin-bottom: 16px;
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

        /* === Quiz top bar === */
        .quiz-top-bar {
          margin-bottom: 10px;
        }

        .quiz-progress-bar {
          height: 4px;
          background: #eee;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .quiz-progress-fill {
          height: 100%;
          background: #4a90d9;
          transition: width 0.3s ease;
        }

        .quiz-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .quiz-progress-text {
          font-size: 12px;
          color: #999;
        }

        .quiz-quit-btn {
          padding: 4px 14px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          color: #888;
          cursor: pointer;
          transition: all 0.15s;
        }

        .quiz-quit-btn:hover {
          background: #e8e8e8;
          color: #e74c3c;
          border-color: #e74c3c;
        }

        /* === Word card === */
        .quiz-word-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 24px 16px;
          text-align: center;
          margin-bottom: 12px;
        }

        .quiz-word {
          font-size: 28px;
          font-weight: 700;
          color: white;
          font-family: Georgia, "Times New Roman", serif;
          letter-spacing: 1px;
        }

        /* === Options === */
        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 10px;
        }

        .quiz-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
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
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
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
          font-size: 14px;
          color: #333;
          line-height: 1.3;
        }

        /* === Feedback === */
        .quiz-feedback {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .feedback-correct {
          color: #27ae60;
          font-weight: 600;
          font-size: 14px;
        }

        .feedback-wrong {
          color: #e74c3c;
          font-weight: 500;
          font-size: 12px;
          flex: 1;
          line-height: 1.3;
        }

        .quiz-next-btn {
          padding: 8px 16px;
          background: #4a90d9;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .quiz-next-btn:hover {
          background: #3a7bc8;
        }

        /* === Result === */
        .quiz-result-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          margin: 20px 0;
        }

        .result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .result-number {
          font-size: 28px;
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

        .quiz-quit-note {
          text-align: center;
          font-size: 13px;
          color: #999;
          margin: 0 0 12px;
        }

        .quiz-wrong-list {
          background: #fff5f5;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 16px;
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

        /* === Mobile adaptation === */
        @media (max-width: 768px) {
          .quiz-overlay {
            padding: 8px;
            align-items: flex-start;
            padding-top: env(safe-area-inset-top, 8px);
          }

          .quiz-modal {
            padding: 16px 14px;
            max-height: 100vh;
            max-height: 100dvh;
            border-radius: 12px;
          }

          .quiz-card-modal {
            padding: 12px 12px;
          }

          .quiz-word-card {
            padding: 18px 12px;
            margin-bottom: 8px;
            border-radius: 10px;
          }

          .quiz-word {
            font-size: 24px;
          }

          .quiz-options {
            gap: 6px;
            margin-bottom: 8px;
          }

          .quiz-option {
            padding: 8px 10px;
            border-radius: 8px;
            gap: 8px;
          }

          .option-label {
            width: 22px;
            height: 22px;
            font-size: 11px;
          }

          .option-text {
            font-size: 13px;
          }

          .quiz-feedback {
            gap: 8px;
          }

          .feedback-wrong {
            font-size: 11px;
          }

          .quiz-next-btn {
            padding: 7px 14px;
            font-size: 12px;
          }

          .quiz-title {
            font-size: 18px;
          }

          .result-number {
            font-size: 24px;
          }

          .quiz-result-stats {
            margin: 14px 0;
            gap: 16px;
          }
        }

        /* Extra small screens (iPhone SE etc.) */
        @media (max-height: 600px) {
          .quiz-word-card {
            padding: 14px 10px;
            margin-bottom: 6px;
          }

          .quiz-word {
            font-size: 20px;
          }

          .quiz-option {
            padding: 6px 8px;
          }

          .option-text {
            font-size: 12px;
          }

          .quiz-options {
            gap: 4px;
            margin-bottom: 6px;
          }

          .quiz-top-bar {
            margin-bottom: 6px;
          }
        }
      `}</style>
    </>
  );
}
