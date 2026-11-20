import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { AppHeader, AppText, AppTextInput, Asset, Screen, SegmentedControl } from '@/components/ui';
import { VocabularySources } from '@/features/vocabulary/components/vocabulary-sources';
import type { Deck } from '@/features/vocabulary/models/deck';
import { catalogueAttributions } from '@/features/vocabulary/models/word-provenance';
import { useDecksViewModel } from '@/features/vocabulary/hooks/use-decks-view-model';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.vocabulary;

function DeckCard({ deck }: { deck: Deck }) {
  const detail = [deck.level ? `Trình độ ${deck.level}` : null, deck.description]
    .filter(Boolean).join(' · ') || 'Bộ từ vựng';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${deck.title}, ${detail}`}
    onPress={() => router.push(`/flashcard?deckId=${encodeURIComponent(deck.id)}&deckTitle=${encodeURIComponent(deck.title)}`)} style={styles.deck}>
    <Asset source={assets.folderIllustration} width={49} height={43} />
    <View style={styles.deckText}>
      <AppText size={18} weight="bold" numberOfLines={1}>{deck.title}</AppText>
      <AppText size={13} color={colors.muted} numberOfLines={1}>{detail}</AppText>
    </View>
    <Asset source={assets.chevronRight} width={18} />
  </Pressable>;
}

export default function VocabularyScreen() {
  const {
    decks, topics, isLoading, isRefreshing, error, refresh, hasCatalogue, needsProfileLevel,
    search, setSearch, tab, setTab, selectedTopic, setTopicKey,
  } = useDecksViewModel();
  return <Screen testID="screen-vocabulary" header={<AppHeader title="Từ vựng" trailing={<View style={styles.headerActions}>
    <Pressable accessibilityRole="button" accessibilityLabel="Làm mới danh sách bộ từ"
      accessibilityState={{ disabled: isLoading || isRefreshing }} disabled={isLoading || isRefreshing}
      onPress={() => void refresh()} hitSlop={8}>
      <AppText size={13} weight="semibold" color={colors.primary}>
        {isRefreshing ? 'Đang tải…' : 'Làm mới'}
      </AppText>
    </Pressable>
    <VocabularySources entries={catalogueAttributions} />
  </View>} />}
    footer={<BottomNavigation active="vocabulary" />} contentStyle={styles.content}>
    <AppTextInput accessibilityLabel="Tìm theo tên bộ từ hoặc chủ đề" placeholder="Tìm theo tên bộ từ hoặc chủ đề"
      value={search} onChangeText={setSearch} autoCapitalize="none"
      icon={<Asset source={assets.search} width={19} />} style={styles.search} inputStyle={{ fontSize: 13 }} />
    <Pressable accessibilityRole="button" accessibilityLabel="Bộ từ vựng của tôi"
      onPress={() => router.push('/my-vocabulary')} style={styles.saved}>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText weight="semibold" color={colors.primary}>Bộ từ vựng của tôi</AppText>
        <AppText size={12} color={colors.muted}>Lưu và quản lý bộ từ của riêng bạn</AppText>
      </View>
      <Asset source={assets.chevronRight} width={18} />
    </Pressable>
    <SegmentedControl labels={['Tất cả', 'Chủ đề']} selected={tab} onPress={setTab} />
    {tab === 1 && topics.length > 0 && <View style={styles.topics}>
      {[{ key: null, label: 'Tất cả chủ đề' }, ...topics].map(topic => {
        const selected = selectedTopic === topic.key;
        return <Pressable key={topic.key ?? 'all'} accessibilityRole="button"
          accessibilityState={{ selected }} accessibilityLabel={`Chủ đề ${topic.label}`}
          onPress={() => setTopicKey(topic.key)} style={[styles.topic, selected && styles.topicSelected]}>
          <AppText size={13} weight={selected ? 'semibold' : 'regular'}
            color={selected ? colors.primary : colors.muted}>{topic.label}</AppText>
        </Pressable>;
      })}
    </View>}
    {isLoading && decks.length === 0 && <AppText color={colors.muted}>Đang tải bộ từ…</AppText>}
    {needsProfileLevel && <View style={styles.state}>
      <AppText weight="semibold">Chọn trình độ tiếng Anh</AppText>
      <AppText color={colors.muted}>Hoàn thiện hồ sơ để xem các bộ từ phù hợp.</AppText>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}>
        <AppText weight="semibold" color={colors.primary}>Mở hồ sơ</AppText>
      </Pressable>
    </View>}
    {error && !needsProfileLevel && <View style={styles.state} accessibilityRole="alert">
      <AppText weight="semibold">Không tải được danh sách bộ từ</AppText>
      <AppText color={colors.muted}>{error}</AppText>
      <Pressable accessibilityRole="button" onPress={() => void refresh()}>
        <AppText weight="semibold" color={colors.primary}>Thử lại</AppText>
      </Pressable>
    </View>}
    {!isLoading && !isRefreshing && !error && decks.length === 0 && <View style={styles.state}>
      <AppText weight="semibold">{hasCatalogue ? 'Không tìm thấy bộ từ' : 'Chưa có bộ từ cho trình độ này'}</AppText>
      <AppText color={colors.muted}>{hasCatalogue ? 'Thử đổi từ khóa hoặc chủ đề.' : 'Bạn có thể xem trình độ trong hồ sơ.'}</AppText>
    </View>}
    {decks.length > 0 && <View style={styles.list}>
      {decks.map(deck => <DeckCard key={deck.id} deck={deck} />)}
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  saved: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: colors.lavender },
  content: { paddingTop: 12, paddingHorizontal: 22, paddingBottom: 20, gap: 20 },
  search: { minHeight: 48, padding: 13, gap: 10, borderRadius: 12 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1,
    borderColor: colors.screenBorder, borderRadius: 16, backgroundColor: colors.surface },
  topicSelected: { borderColor: colors.primary },
  list: { gap: 13 },
  state: { gap: 10, paddingVertical: 14 },
  deck: { minHeight: 87, paddingHorizontal: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 15,
    borderBottomWidth: 1, borderBottomColor: colors.screenBorder },
  deckText: { flex: 1, minWidth: 0, gap: 7 },
});
