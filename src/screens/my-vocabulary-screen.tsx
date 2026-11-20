import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { AppText, AppTextInput, Asset, PrimaryButton, Screen } from '@/components/ui';
import { useMyVocabulary } from '@/features/vocabulary/hooks/use-my-vocabulary';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

export default function MyVocabularyScreen() {
  const model = useMyVocabulary();
  const busy = model.isLoading || model.isRefreshing || model.isSearching;
  const visibleGroups = model.groups.filter(group => !model.level || group.level === model.level);

  return <Screen testID="screen-my-vocabulary" contentStyle={styles.content}
    header={<View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại Từ vựng"
        onPress={() => router.dismissTo('/vocabulary')} style={styles.back}>
        <AppText size={22} color={colors.primary}>‹</AppText>
      </Pressable>
      <AppText accessibilityRole="header" size={18} weight="semibold">Bộ từ vựng của tôi</AppText>
    </View>}
    footer={<BottomNavigation active="vocabulary" />}>
    <View style={styles.summary}>
      <View style={styles.summaryText}>
        <AppText size={16} weight="semibold" color={colors.primary}>Tất cả từ đã lưu</AppText>
        <AppText size={12} color={colors.muted}>Từ được đánh dấu trong Flashcards</AppText>
      </View>
      <AppText size={24} weight="bold" color={colors.primary}>{model.totalSaved ?? '—'}</AppText>
    </View>
    <AppTextInput value={model.search} onChangeText={model.setSearch} maxLength={200} autoCapitalize="none"
      accessibilityLabel="Tìm trong bộ từ của tôi" placeholder="Tìm trong bộ từ của tôi"
      icon={<Asset source={figmaAssets.vocabulary.search} width={19} />} />
    <View style={styles.filters} accessibilityRole="tablist">
      {(['', 'A1', 'A2'] as const).map(level => <Pressable key={level || 'all'} accessibilityRole="tab"
        accessibilityState={{ selected: model.level === level }} onPress={() => model.setLevel(level)}
        style={[styles.filter, model.level === level && styles.filterSelected]}>
        <AppText size={13} weight="semibold" color={model.level === level ? colors.surface : colors.muted}>
          {level || 'Tất cả'}
        </AppText>
      </Pressable>)}
    </View>
    {busy && <ActivityIndicator color={colors.primary} />}
    {model.error && <View style={styles.state}>
      <AppText accessibilityRole="alert" color={colors.error}>Chưa tải được bộ từ đã lưu.</AppText>
      <PrimaryButton title="Thử lại" onPress={model.refresh} />
    </View>}
    {!busy && !model.error && visibleGroups.length === 0 && <View style={styles.empty}>
      <AppText weight="semibold">Chưa có từ đã lưu</AppText>
      <AppText color={colors.muted}>{model.level
        ? `Không có từ đã lưu ở trình độ ${model.level}.`
        : 'Đánh dấu từ trong Flashcards để thêm vào đây.'}</AppText>
    </View>}
    {!model.error && visibleGroups.map(group => <Pressable key={group.groupId}
      accessibilityRole="button" accessibilityLabel={`${group.title}, ${group.wordCount} từ`}
      onPress={() => router.push({ pathname: '/my-vocabulary/[groupId]', params: { groupId: group.groupId } })}
      style={styles.group}>
      <Asset source={figmaAssets.vocabulary.folderIllustration} width={30} height={26} />
      <View style={styles.groupText}>
        <AppText weight="semibold" numberOfLines={1}>{group.title}</AppText>
        <AppText size={12} color={colors.muted}>{group.wordCount} từ</AppText>
      </View>
      <Asset source={figmaAssets.vocabulary.chevronRight} width={16} />
    </Pressable>)}
    {!model.error && (model.totalSaved ?? 0) > 0 && <PrimaryButton
      title={model.level ? `Học tất cả từ ${model.level}` : 'Học tất cả từ đã lưu'} disabled={busy}
      onPress={() => router.push({ pathname: '/saved-flashcards', params: { level: model.level || undefined } })} />}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  header: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 40, height: 44, justifyContent: 'center' },
  summary: { padding: 16, borderRadius: 14, backgroundColor: colors.lavender,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { gap: 4 },
  filters: { minHeight: 43, padding: 4, gap: 4, flexDirection: 'row',
    backgroundColor: colors.tabs, borderRadius: 10 },
  filter: { flex: 1, minHeight: 35, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { backgroundColor: colors.primary },
  group: { minHeight: 76, padding: 12, borderRadius: 12, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.screenBorder, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupText: { flex: 1, minWidth: 0, gap: 3 },
  empty: { paddingVertical: 22, gap: 8 },
  state: { gap: 10 },
});
