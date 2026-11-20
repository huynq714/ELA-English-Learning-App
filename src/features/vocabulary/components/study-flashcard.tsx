import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText, Asset } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';
import type { useFlashcardAudio } from '../hooks/use-flashcard-audio';
import { verifiedVietnamese, type Word } from '../models/word';
import { dictionaryRecording } from '../models/word-provenance';

export function StudyFlashcard({ word, audio, bookmark }: {
  word: Word; audio: ReturnType<typeof useFlashcardAudio>; bookmark?: ReactNode;
}) {
  const [revealed, setRevealed] = useState(false);
  const [turning, setTurning] = useState(false);
  const turnInProgress = useRef(false);
  const [angle] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();
  const meaningVi = verifiedVietnamese(word);
  const meaning = meaningVi ?? word.definitionEn ?? 'Thẻ này chưa có định nghĩa.';
  const example = word.exampleEn;
  const recording = dictionaryRecording(word);

  useEffect(() => () => angle.stopAnimation(), [angle]);

  const flip = () => {
    if (turnInProgress.current) return;
    if (reduceMotion) {
      setRevealed(!revealed);
      return;
    }

    const animateTo = (toValue: number) => Animated.timing(angle, {
      toValue, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web',
    });
    turnInProgress.current = true;
    setTurning(true);
    animateTo(90).start(({ finished }) => {
      if (!finished) return;
      setRevealed(!revealed);
      angle.setValue(-90);
      animateTo(0).start(({ finished: arrived }) => {
        if (!arrived) return;
        turnInProgress.current = false;
        setTurning(false);
      });
    });
  };

  return <View style={[styles.layout, !example && styles.withoutExample]} testID="flashcard-content">
    <Animated.View style={[
      styles.surface,
      revealed && styles.backSurface,
      { transform: [{ perspective: 1000 }, { rotateY: angle.interpolate({
        inputRange: [-90, 90], outputRange: ['-90deg', '90deg'],
      }) }] },
    ]} testID="flashcard-surface">
      {bookmark && <View style={styles.bookmark}>{bookmark}</View>}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: revealed, disabled: turning }}
        accessibilityLabel={revealed ? `${word.headword}. ${meaning}` : word.headword}
        accessibilityHint={revealed ? 'Chạm để xem mặt trước' : 'Chạm để xem nghĩa'}
        disabled={turning} onPress={flip} style={styles.face} testID="flashcard-flip">
        {revealed ? <>
          <AppText size={14} weight="semibold" color={colors.primaryDark}>
            {meaningVi ? 'Nghĩa tiếng Việt' : 'Định nghĩa'}
          </AppText>
          <AppText size={27} weight="bold" style={styles.center} testID="flashcard-meaning">
            {meaning}
          </AppText>
        </> : <>
          <AppText size={44} weight="extrabold" style={styles.center} testID="flashcard-headword">{word.headword}</AppText>
          {word.ipa && <AppText size={21} color={colors.muted} style={styles.center}>{word.ipa}</AppText>}
        </>}
        <AppText size={13} color={colors.textSecondary} style={styles.hint}>
          {revealed ? 'Chạm để xem mặt trước' : 'Chạm để lật thẻ'}
        </AppText>
      </Pressable>
      <View style={styles.wordAudio}>
        <AudioButton label="Nghe phát âm từ" detail={recording ? recording.accent ?? 'Từ điển' : 'Giọng máy'}
          loading={audio.playback?.phase === 'loading' && audio.playback.target === 'word'}
          onPress={() => void audio.play('word', recording ?? { text: word.headword })} />
      </View>
    </Animated.View>
    {example && <View style={styles.example}>
      <View style={styles.exampleRow}>
        <AppText size={19} style={styles.exampleText}>{example}</AppText>
        <AudioButton label="Nghe câu ví dụ" detail="Giọng máy"
          loading={audio.playback?.phase === 'loading' && audio.playback.target === 'example'}
          onPress={() => void audio.play('example', { text: example })} />
      </View>
      {revealed && word.exampleVi && <AppText color={colors.textSecondary}>{word.exampleVi}</AppText>}
    </View>}
    {audio.playback?.phase === 'error' && <AppText accessibilityRole="alert" color={colors.textSecondary}>
      {audio.playback.target === 'word' && recording
        ? 'Chưa phát được bản ghi từ điển. Kiểm tra mạng rồi thử lại.'
        : 'Chưa phát được âm thanh. Hãy thử lại.'}
    </AppText>}
  </View>;
}

function AudioButton({ label, detail, loading, onPress }: {
  label: string; detail: string; loading: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail}
    accessibilityState={{ busy: loading }} onPress={onPress}
    style={({ pressed }) => [styles.audio, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={colors.primary} /> : <Asset source={figmaAssets.flashcard.volume2} width={23} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  layout: { flexGrow: 1, justifyContent: 'space-evenly', gap: 30, paddingVertical: 18 },
  withoutExample: { justifyContent: 'center' },
  surface: {
    borderWidth: 2, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.surface,
    boxShadow: '0 7px 18px rgba(24, 33, 62, 0.10)', backfaceVisibility: 'hidden',
  },
  backSurface: { borderColor: colors.primary, backgroundColor: colors.lavender },
  face: { minHeight: 238, paddingTop: 42, paddingHorizontal: 20, paddingBottom: 22,
    gap: 12, justifyContent: 'center', alignItems: 'center' },
  center: { textAlign: 'center' },
  hint: { marginTop: 12, textAlign: 'center' },
  bookmark: { position: 'absolute', top: 8, left: 10, zIndex: 2 },
  wordAudio: { position: 'absolute', top: 8, right: 10, zIndex: 2 },
  audio: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender },
  pressed: { opacity: 0.72 },
  example: { gap: 10, paddingHorizontal: 10 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleText: { lineHeight: 28, flex: 1 },
});
