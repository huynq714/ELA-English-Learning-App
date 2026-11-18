import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText, Asset } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';
import { verifiedVietnamese, type Word } from '../models/word';

export function StudyFlashcard({ word, onSpeak, speechFailed }: {
  word: Word; onSpeak: (text: string) => void; speechFailed: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [turning, setTurning] = useState(false);
  const turnInProgress = useRef(false);
  const [angle] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();
  const meaningVi = verifiedVietnamese(word);
  const meaning = meaningVi ?? word.definitionEn ?? 'Thẻ này chưa có định nghĩa.';
  const example = word.exampleEn;

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
        <AudioButton label="Nghe phát âm từ" onPress={() => onSpeak(word.headword)} />
      </View>
    </Animated.View>
    {example && <View style={styles.example}>
      <AppText size={19} style={styles.exampleText}>{example}</AppText>
      {revealed && word.exampleVi && <AppText color={colors.textSecondary}>{word.exampleVi}</AppText>}
      <View style={styles.exampleAudio}>
        <AudioButton label="Nghe câu ví dụ" onPress={() => onSpeak(example)} />
      </View>
    </View>}
    {speechFailed && <AppText accessibilityRole="alert" color={colors.textSecondary}>Chưa phát được âm thanh. Hãy thử lại.</AppText>}
  </View>;
}

function AudioButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.audio, pressed && styles.pressed]}>
    <Asset source={figmaAssets.flashcard.volume2} width={23} />
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
  wordAudio: { position: 'absolute', top: 10, right: 10 },
  audio: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender },
  pressed: { opacity: 0.72 },
  example: { gap: 10, paddingHorizontal: 10 },
  exampleText: { lineHeight: 28 },
  exampleAudio: { alignItems: 'flex-end' },
});
