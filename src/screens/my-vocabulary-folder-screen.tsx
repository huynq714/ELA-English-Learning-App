import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/bottom-navigation';
import { AppText, AppTextInput, Asset, PrimaryButton } from '@/components/ui';
import { useSavedFolderDetail } from '@/features/vocabulary/hooks/use-saved-folder-detail';
import { verifiedVietnamese, type Word } from '@/features/vocabulary/models/word';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

export default function MyVocabularyFolderScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const model = useSavedFolderDetail(groupId ?? '');
  const hasWords = (model.group?.wordCount ?? 0) > 0;
  const busy = model.isLoading || model.isRefreshing || model.isSearching || !!model.pendingId;
  const folderDescription = model.group?.description?.trim()
    || (model.group?.topic ? `Chủ đề: ${model.group.topic}` : '');

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/my-vocabulary');
  }, []);

  const openWord = (word: Word) => {
    if (!groupId) return;
    router.push({ pathname: '/saved-flashcards', params: { groupId, wordId: word.id } });
  };

  const listHeader = <View style={styles.listHeader}>
    <View style={styles.folderInfo}>
      <Asset source={figmaAssets.vocabulary.folderIllustration} width={28} height={25}
        style={{ tintColor: colors.primary }} />
      <View style={styles.folderText}>
        <AppText size={17} weight="semibold" numberOfLines={2}>
          {model.group?.title ?? (model.groupError ? 'Không tìm thấy thư mục' : 'Đang tải thư mục…')}
        </AppText>
        <AppText size={12} color={colors.muted}>{model.group ? `${model.group.wordCount} từ đã lưu` : ' '}</AppText>
      </View>
    </View>
    {!!folderDescription && <AppText size={12} color={colors.muted} style={styles.description}>
      {folderDescription}
    </AppText>}
    <AppTextInput value={model.search} onChangeText={model.setSearch} maxLength={200} autoCapitalize="none"
      accessibilityLabel="Tìm từ trong thư mục" placeholder="Tìm từ trong thư mục"
      icon={<Asset source={figmaAssets.vocabulary.search} width={19} />} />
    <AppText size={15} weight="semibold" style={styles.sectionTitle}>Từ vựng đã lưu</AppText>
  </View>;

  const empty = model.error
    ? <View style={styles.listState}>
      <AppText accessibilityRole="alert" color={colors.error}>
        {model.groupError ? 'Không tải được thông tin thư mục.' : 'Không tải được từ đã lưu trong thư mục.'}
      </AppText>
      <PrimaryButton title="Thử lại" onPress={model.refresh} />
    </View>
    : busy
      ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><AppText color={colors.muted}>Đang tải từ đã lưu…</AppText></View>
      : <AppText color={colors.muted} style={styles.listState}>
        {model.search.trim() ? 'Không tìm thấy từ phù hợp trong thư mục.' : 'Chưa có từ nào được lưu trong thư mục này.'}
      </AppText>;

  return <SafeAreaView testID="screen-my-vocabulary-folder" style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại Bộ từ vựng của tôi"
          onPress={back} style={styles.back}>
          <AppText size={22} color={colors.ink}>‹</AppText>
        </Pressable>
        <AppText accessibilityRole="header" size={18} weight="semibold">Chi tiết bộ từ</AppText>
      </View>
      <FlatList
        data={model.words}
        keyExtractor={word => word.id}
        renderItem={({ item }) => <Pressable accessibilityRole="button"
          accessibilityLabel={`${item.headword}, ${verifiedVietnamese(item) ?? item.meaningVi}`}
          onPress={() => openWord(item)} style={({ pressed }) => [styles.wordCard, pressed && styles.pressed]}>
          <View style={styles.wordText}>
            <AppText size={14} weight="medium" numberOfLines={1}>{item.headword}</AppText>
            <AppText size={12} color={colors.muted} numberOfLines={1}>
              {verifiedVietnamese(item) ?? item.meaningVi}
            </AppText>
          </View>
          <Asset source={figmaAssets.vocabulary.chevronRight} width={16} />
        </Pressable>}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={model.isRefreshing && !model.isLoading}
          onRefresh={model.refresh} tintColor={colors.primary} />}
      />
      <View style={styles.action}>
        <PrimaryButton title="Ôn tập bộ từ" disabled={!groupId || !hasWords || busy}
          onPress={() => groupId && router.push({ pathname: '/saved-flashcards', params: { groupId } })} />
        {model.actionError && <AppText accessibilityRole="alert" size={12} color={colors.error}>
          {model.actionError}
        </AppText>}
        {model.group && !hasWords && <AppText size={12} color={colors.muted} style={styles.emptyReview}>
          Thư mục chưa có từ để ôn tập.
        </AppText>}
      </View>
      <BottomNavigation active="vocabulary" />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1 },
  header: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  back: { width: 34, height: 44, justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8, flexGrow: 1 },
  listHeader: { gap: 14, paddingBottom: 4 },
  folderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  folderText: { flex: 1, minWidth: 0, gap: 3 },
  description: { lineHeight: 18 },
  sectionTitle: { marginTop: 2 },
  wordCard: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11,
    borderWidth: 1, borderColor: colors.screenBorder, backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordText: { flex: 1, minWidth: 0, gap: 4 },
  pressed: { opacity: 0.72 },
  listState: { paddingVertical: 18 },
  loading: { paddingVertical: 20, alignItems: 'center', gap: 10 },
  action: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 6, backgroundColor: colors.screen },
  emptyReview: { textAlign: 'center' },
});
