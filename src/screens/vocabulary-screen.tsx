import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { useDemoNotice } from '@/components/demo-notice';
import { AppHeader, AppText, AppTextInput, Asset, Screen, SegmentedControl } from '@/components/ui';
import type { Deck } from '@/features/vocabulary/models/deck';
import { useDecksViewModel } from '@/features/vocabulary/hooks/use-decks-view-model';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

const assets = figmaAssets.vocabulary;

function DeckCard({ deck, purple }: { deck: Deck; purple: boolean }) {
  const notice = useDemoNotice();
  const detail = [deck.level ? `Trình độ ${deck.level}` : null, deck.description]
    .filter(Boolean).join(' · ') || 'Bộ từ vựng';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${deck.title}, ${detail}`}
    onPress={() => deck.title === 'Travel' ? router.push('/flashcard') : notice(`Bộ từ ${deck.title}`)} style={styles.deck}>
    <Asset source={purple ? assets.folderIllustration1 : assets.folderIllustration} width={49} height={43} />
    <View style={styles.deckText}>
      <AppText size={18} weight="bold" numberOfLines={1}>{deck.title}</AppText>
      <AppText size={13} color={colors.muted} numberOfLines={1}>{detail}</AppText>
    </View>
    <Asset source={assets.chevronRight} width={18} />
  </Pressable>;
}

export default function VocabularyScreen() {
  const notice = useDemoNotice();
  const { decks, isLoading, isRefreshing, error, refresh } = useDecksViewModel();
  return <Screen testID="screen-vocabulary" header={<AppHeader title="Từ vựng" trailing={
    <Pressable accessibilityRole="button" accessibilityLabel="Làm mới danh sách bộ từ"
      accessibilityState={{ disabled: isLoading || isRefreshing }} disabled={isLoading || isRefreshing}
      onPress={() => void refresh()} hitSlop={8}>
      <AppText size={13} weight="semibold" color={colors.primary}>
        {isRefreshing ? 'Đang tải…' : 'Làm mới'}
      </AppText>
    </Pressable>
  } />}
    footer={<BottomNavigation active="vocabulary" />} contentStyle={styles.content}>
    <AppTextInput accessibilityLabel="Tìm kiếm chủ đề, từ vựng" placeholder="Tìm kiếm chủ đề, từ vựng"
      editable={false} icon={<Asset source={assets.search} width={19} />} style={styles.search} inputStyle={{ fontSize: 13 }} />
    <SegmentedControl labels={['Tất cả', 'Chủ đề', 'Bộ từ']} selected={0}
      onPress={index => { if (index !== 0) notice('Lọc chủ đề và bộ từ'); }} />
    {isLoading && decks.length === 0 && <AppText color={colors.muted}>Đang tải bộ từ…</AppText>}
    {error && <View style={styles.state} accessibilityRole="alert">
      <AppText weight="semibold">Không tải được danh sách bộ từ</AppText>
      <AppText color={colors.muted}>{error}</AppText>
      <Pressable accessibilityRole="button" onPress={() => void refresh()}>
        <AppText weight="semibold" color={colors.primary}>Thử lại</AppText>
      </Pressable>
    </View>}
    {!isLoading && !error && decks.length === 0 && <View style={styles.state}>
      <AppText weight="semibold">Chưa có bộ từ được xuất bản</AppText>
      <AppText color={colors.muted}>Các bộ từ sẽ xuất hiện ở đây khi được thêm vào thư viện.</AppText>
    </View>}
    {decks.length > 0 && <View style={styles.list}>
      {decks.map((deck, index) => <DeckCard key={deck.id} deck={deck} purple={index % 3 === 2} />)}
    </View>}
    <View style={styles.addRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Thêm bộ từ" onPress={() => notice('Tạo bộ từ')} style={styles.add}>
        <Asset source={assets.plus} width={27} />
      </Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingHorizontal: 22, paddingBottom: 20, gap: 20 },
  search: { minHeight: 48, padding: 13, gap: 10, borderRadius: 12 },
  list: { gap: 13 },
  state: { gap: 10, paddingVertical: 14 },
  deck: { minHeight: 87, paddingHorizontal: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 15,
    borderBottomWidth: 1, borderBottomColor: colors.screenBorder },
  deckText: { flex: 1, minWidth: 0, gap: 7 },
  addRow: { alignItems: 'flex-end' },
  add: { width: 54, height: 54, borderRadius: 100, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
