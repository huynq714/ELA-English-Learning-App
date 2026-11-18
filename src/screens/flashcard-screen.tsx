import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { AppHeader, AppText, Asset, ProgressBar, Screen } from '@/components/ui';
import { useDeckWordsViewModel } from '@/features/vocabulary/hooks/use-deck-words-view-model';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.flashcard;
const ratings = [
  { label: 'Again', icon: assets.rotateCcw, background: colors.errorSurface, color: colors.error },
  { label: 'Hard', icon: assets.clock3, background: colors.warningSurface, color: colors.warning },
  { label: 'Good', icon: assets.checkCheck, background: colors.successSurface, color: colors.success },
  { label: 'Easy', icon: assets.calendarCheck, background: colors.lavender, color: colors.primary },
] as const;

type Rating = typeof ratings[number]['label'];

export default function FlashcardScreen() {
  const params = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();
  const deckId = Array.isArray(params.deckId) ? params.deckId[0] : params.deckId;
  const deckTitle = Array.isArray(params.deckTitle) ? params.deckTitle[0] : params.deckTitle;
  const { words, isLoading, isRefreshing, error, refresh } = useDeckWordsViewModel(deckId);
  const [index, setIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [ratingsByWord, setRatingsByWord] = useState<Partial<Record<string, Rating>>>({});
  const activeIndex = Math.max(0, Math.min(index, words.length - 1));
  const word = words[activeIndex];

  const openCard = (nextIndex: number) => {
    setIndex(nextIndex);
    setShowDefinition(false);
  };

  const rate = (rating: Rating) => {
    if (!word) return;
    setRatingsByWord(previous => ({ ...previous, [word.id]: rating }));
    if (rating === 'Again') {
      setShowDefinition(false);
    } else if (activeIndex < words.length - 1) {
      openCard(activeIndex + 1);
    }
  };

  return <Screen testID="screen-flashcard" contentStyle={styles.content}
    header={<AppHeader title={deckTitle || 'Vocabulary'} trailing={
      <AppText size={14} weight="semibold" color={colors.muted}>{words.length ? `${activeIndex + 1}/${words.length}` : '0/0'}</AppText>
    } />}
    footer={word && <View style={styles.footer}>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={activeIndex === 0} onPress={() => openCard(activeIndex - 1)} style={styles.action}>
          <AppText color={activeIndex === 0 ? colors.muted : colors.primary}>Previous</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={activeIndex === words.length - 1} onPress={() => openCard(activeIndex + 1)} style={styles.action}>
          <AppText color={activeIndex === words.length - 1 ? colors.muted : colors.primary}>Next</AppText>
        </Pressable>
      </View>
      <View style={styles.ratings}>
        {ratings.map(({ label, icon, background, color }) => {
          const selected = ratingsByWord[word.id] === label;
          return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }}
            onPress={() => rate(label)}
            style={[styles.rating, { backgroundColor: background, borderColor: selected ? color : 'transparent' }]}>
            <Asset source={icon} width={23} />
            <AppText size={13} weight="bold" color={color}>{label}</AppText>
          </Pressable>;
        })}
      </View>
    </View>}>
    {isLoading && <AppText color={colors.muted}>Loading words…</AppText>}
    {!!error && <View style={styles.state} accessibilityRole="alert">
      <AppText weight="semibold">Could not load this deck</AppText>
      <AppText color={colors.muted}>{error}</AppText>
      <Pressable accessibilityRole="button" onPress={() => void refresh()}><AppText weight="semibold" color={colors.primary}>Try again</AppText></Pressable>
    </View>}
    {!isLoading && !error && words.length === 0 && <View style={styles.state}>
      <AppText weight="semibold">This deck has no words yet</AppText>
      <Pressable accessibilityRole="button" disabled={isRefreshing} onPress={() => void refresh()}>
        <AppText weight="semibold" color={colors.primary}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</AppText>
      </Pressable>
    </View>}
    {word && <>
      <ProgressBar value={(activeIndex + 1) / words.length} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${word.headword}, ${showDefinition ? 'Ẩn nghĩa' : 'Xem nghĩa'}`} onPress={() => setShowDefinition(value => !value)} style={styles.wordCard}>
        <AppText size={39} weight="extrabold" style={styles.center}>{word.headword}</AppText>
        {!!word.partOfSpeech && <AppText size={14} color={colors.muted}>{word.partOfSpeech}{word.cefrLevel ? ` · ${word.cefrLevel}` : ''}</AppText>}
        {!!word.ipa && <AppText size={20} color={colors.muted}>{word.ipa}</AppText>}
        <View style={styles.translation}>
          <AppText size={14} weight="semibold" color={colors.primary}>
            {showDefinition ? (word.meaningVi ? 'Nghĩa tiếng Việt' : 'English definition') : 'Definition'}
          </AppText>
          {showDefinition
            ? <AppText size={15} style={styles.center}>{word.meaningVi || word.definitionEn || 'No definition is available for this word.'}</AppText>
            : <AppText size={14} color={colors.primary}>Tap to reveal</AppText>}
        </View>
      </Pressable>
      {!!word.exampleEn && <View style={styles.example}>
        <AppText size={12} weight="semibold" color={colors.muted}>Ví dụ</AppText>
        <AppText size={17} style={{ lineHeight: 25 }}>{word.exampleEn}</AppText>
        {!!word.exampleVi && <AppText size={15} color={colors.muted} style={styles.exampleTranslation}>{word.exampleVi}</AppText>}
      </View>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingHorizontal: 22, paddingBottom: 18, gap: 20 },
  state: { gap: 12, paddingVertical: 18 },
  wordCard: { padding: 22, minHeight: 230, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.surface },
  center: { textAlign: 'center' },
  translation: { width: '100%', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.lavender },
  example: { gap: 9, paddingHorizontal: 8 },
  exampleTranslation: { lineHeight: 22 },
  footer: { paddingHorizontal: 22, paddingBottom: 12, backgroundColor: colors.screen },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 7 },
  ratings: { flexDirection: 'row', gap: 8 },
  rating: { flex: 1, minWidth: 0, minHeight: 68, paddingVertical: 10, gap: 6, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
});
