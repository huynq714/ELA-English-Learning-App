import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, AppText, PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import { useQuizViewModel } from '@/features/quiz/use-quiz-view-model';
import { colors } from '@/theme/tokens';

export default function QuizScreen() {
  const params = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();
  const deckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const deckTitle = Array.isArray(params.deckTitle) ? params.deckTitle[0] : params.deckTitle;
  const flow = useQuizViewModel(deckId);
  const { quiz, question, result, pending, error, selected, feedback, unconfirmedOption } = flow;
  const last = quiz && flow.index === quiz.questions.length - 1;
  const checking = unconfirmedOption !== null;
  const choicesLocked = pending || checking || !!feedback;

  const study = () => {
    if (deckId) router.dismissTo({ pathname: '/flashcard', params: { deckId, deckTitle: deckTitle ?? '' } });
    else router.dismissTo('/vocabulary');
  };

  return <Screen testID="screen-quiz" contentStyle={styles.content}
    header={<AppHeader title="Quiz" trailing={
      <Pressable accessibilityRole="button" onPress={study} disabled={pending} style={styles.link}>
        <AppText color={colors.primary}>Quay lại</AppText>
      </Pressable>
    } />}>
    {result ? <>
      <View style={[styles.panel, result.passed ? styles.pass : styles.fail]} testID="quiz-result">
        <AppText size={18} weight="bold" color={result.passed ? colors.success : colors.error}>
          {result.passed ? 'PASS · Đạt' : 'FAIL · Chưa đạt'}
        </AppText>
        <AppText size={38} weight="extrabold">{result.correctCount}/{result.totalQuestions}</AppText>
        <AppText weight="medium">{result.percentage}% câu trả lời đúng</AppText>
      </View>
      <AppText color={colors.textSecondary}>
        {result.passed ? 'Bạn đã đạt yêu cầu của bộ từ này.' : 'Ôn lại các từ trong bài vừa làm để mở lượt thi tiếp theo.'}
      </AppText>
      <PrimaryButton title={result.passed ? 'Hoàn thành' : 'Ôn lại Flashcards'}
        onPress={result.passed ? () => router.dismissTo('/vocabulary') : study} />
    </> : question && quiz ? <>
      <AppText weight="semibold" color={colors.textSecondary}>
        Câu {question.questionNo}/{quiz.questions.length} · {quiz.direction === 'EN_TO_VI' ? 'Anh → Việt' : 'Việt → Anh'}
      </AppText>
      <ProgressBar value={question.questionNo / quiz.questions.length} />
      <View style={styles.prompt}>
        <AppText size={15} weight="medium" color={colors.textSecondary}>
          {quiz.direction === 'EN_TO_VI' ? 'Chọn nghĩa tiếng Việt' : 'Chọn từ tiếng Anh'}
        </AppText>
        <AppText accessibilityRole="header" size={27} weight="bold">{question.prompt}</AppText>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {question.options.map((option, index) =>
          <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: selected === index, disabled: choicesLocked }}
            disabled={choicesLocked} onPress={() => void flow.select(index)} style={[
              styles.option, selected === index && styles.selected,
              feedback?.correctOption === index && styles.correctOption,
              feedback && !feedback.correct && selected === index && styles.wrongOption,
            ]}>
            <AppText weight="semibold" color={selected === index ? colors.primary : colors.textSecondary}>
              {String.fromCharCode(65 + index)}
            </AppText>
            <AppText style={styles.optionText}>{option}</AppText>
          </Pressable>
        )}
      </View>
      {feedback && <View accessibilityRole="alert" testID="quiz-answer-feedback"
        style={[styles.feedback, !feedback.correct && styles.wrongFeedback]}>
        <AppText size={14} weight="semibold" color={feedback.correct ? colors.primaryDark : colors.textPrimary}>
          {feedback.correct ? 'Chính xác' : 'Chưa đúng'}
        </AppText>
        <AppText size={13} color={colors.textSecondary}>Đáp án đúng</AppText>
        <AppText size={17} weight="bold">
          {String.fromCharCode(65 + feedback.correctOption)}. {question.options[feedback.correctOption]}
        </AppText>
      </View>}
      {error && <AppText accessibilityRole="alert" color={colors.error}>{error}</AppText>}
      {unconfirmedOption !== null
        ? <PrimaryButton title={pending ? 'Đang kiểm tra…' : 'Thử kiểm tra lại'}
          testID="quiz-answer-retry" disabled={pending} onPress={() => void flow.select(unconfirmedOption)} />
        : <PrimaryButton title={pending ? 'Đang nộp…' : last ? (error ? 'Thử nộp lại' : 'Nộp bài') : 'Tiếp theo'}
          testID="quiz-advance" disabled={!feedback || pending} onPress={() => void flow.advance()} />}
      {flow.index > 0 && <Pressable accessibilityRole="button" disabled={pending || checking} onPress={flow.previous} style={styles.link}>
        <AppText color={colors.primary}>Câu trước</AppText>
      </Pressable>}
    </> : <>
      <View style={styles.panel}>
        <AppText accessibilityRole="header" size={25} weight="bold">{deckTitle || 'Kiểm tra từ vựng'}</AppText>
        <AppText color={colors.textSecondary}>5 câu trắc nghiệm · Đạt từ 3 câu đúng</AppText>
      </View>
      {(error || !deckId) && <AppText accessibilityRole="alert" color={colors.error}>
        {error || 'Hãy mở Quiz từ bộ từ đang học.'}
      </AppText>}
      <PrimaryButton title={pending ? 'Đang tải…' : error ? 'Thử lại' : 'Bắt đầu'}
        testID="quiz-start" disabled={pending || !deckId} onPress={() => void flow.start()} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 22, gap: 18 },
  panel: { gap: 12, padding: 24, borderRadius: 18, backgroundColor: colors.lavender },
  pass: { backgroundColor: colors.successSurface, alignItems: 'center' },
  fail: { backgroundColor: colors.errorSurface, alignItems: 'center' },
  prompt: { gap: 10, padding: 18, borderRadius: 15, backgroundColor: colors.lavender },
  options: { gap: 10 },
  option: { minHeight: 54, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    gap: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  optionText: { flex: 1 },
  selected: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
  correctOption: { backgroundColor: colors.successSurface, borderColor: colors.success },
  wrongOption: { backgroundColor: colors.errorSurface, borderColor: colors.error },
  feedback: { padding: 15, gap: 7, borderWidth: 1, borderRadius: 13,
    backgroundColor: colors.primarySurface, borderColor: colors.primary },
  wrongFeedback: { backgroundColor: colors.errorSurface, borderColor: colors.error },
  link: { minHeight: 44, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
});
