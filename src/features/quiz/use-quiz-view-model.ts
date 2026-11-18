import { useRef, useState } from 'react';

import { useSession } from '@/features/auth/view-model/session-context';
import { ApiError } from '@/services/api-client';
import { quizRepository, type AnswerFeedback, type Quiz, type QuizResult } from './quiz-repository';

const retryMessages = {
  start: 'Chưa tải được bài Quiz. Hãy thử lại.',
  answer: 'Chưa kiểm tra được đáp án. Hãy thử lại với lựa chọn vừa chọn.',
  submit: 'Chưa nộp được bài. Các lựa chọn vẫn được giữ để bạn gửi lại.',
};

function explain(error: unknown, action: keyof typeof retryMessages) {
  if (error instanceof ApiError) {
    if (error.code === 'STUDY_REQUIRED') return 'Bạn cần lật hết thẻ trong bộ trước khi làm Quiz.';
    if (error.code === 'REVIEW_REQUIRED') return 'Bạn cần ôn lại các từ trong bài vừa làm trước khi thi lại.';
    if (error.code === 'QUIZ_UNAVAILABLE') return 'Bộ từ chưa đủ 5 câu có đáp án phân biệt được.';
    if (error.status === 404) return 'Bộ từ hoặc bài Quiz không còn khả dụng.';
    if (error.status === 401 || error.status === 403) return 'Hãy đăng nhập lại để tiếp tục.';
    if (!error.status) return 'Mất kết nối. Hãy kiểm tra mạng rồi thử lại.';
  }
  return retryMessages[action];
}

export function useQuizViewModel(deckId: string | undefined) {
  const { authenticated } = useSession();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<number, AnswerFeedback>>>({});
  const [unconfirmedOption, setUnconfirmedOption] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const question = quiz?.questions[index];
  const feedback = question ? answers[question.questionNo] : undefined;
  const selected = feedback?.selectedOption ?? unconfirmedOption;

  const start = async () => {
    if (!deckId || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const loaded = await authenticated(token => quizRepository.start(token, deckId));
      const recorded = Object.fromEntries(loaded.answered.map(answer => [answer.questionNo, answer]));
      const nextQuestion = loaded.questions.findIndex(question => !recorded[question.questionNo]);
      setQuiz(loaded);
      setAnswers(recorded);
      setIndex(nextQuestion < 0 ? loaded.questions.length - 1 : nextQuestion);
    } catch (failure) {
      setError(explain(failure, 'start'));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const select = async (optionIndex: number) => {
    if (!quiz || !question || feedback || inFlight.current
        || (unconfirmedOption !== null && unconfirmedOption !== optionIndex)) return;
    inFlight.current = true;
    setPending(true);
    setUnconfirmedOption(optionIndex);
    setError(null);
    try {
      const answer = await authenticated(token => quizRepository.answer(token, quiz.attemptId, {
        questionNo: question.questionNo, optionIndex,
      }));
      setAnswers(previous => ({ ...previous, [answer.questionNo]: answer }));
      setUnconfirmedOption(null);
    } catch (failure) {
      setError(explain(failure, 'answer'));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const advance = async () => {
    if (!quiz || !feedback || inFlight.current) return;
    if (index < quiz.questions.length - 1) {
      setIndex(index + 1);
      setError(null);
      return;
    }
    const selections = quiz.questions.flatMap(({ questionNo }) => {
      const answer = answers[questionNo];
      return answer ? [{ questionNo, optionIndex: answer.selectedOption }] : [];
    });
    if (selections.length !== quiz.questions.length) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      setResult(await authenticated(token => quizRepository.submit(token, quiz.attemptId, selections)));
    } catch (failure) {
      setError(explain(failure, 'submit'));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const previous = () => {
    if (inFlight.current || unconfirmedOption !== null || index === 0) return;
    setIndex(index - 1);
    setError(null);
  };

  return { quiz, question, selected, feedback, unconfirmedOption, index, result, error, pending, start, select, advance, previous };
}
