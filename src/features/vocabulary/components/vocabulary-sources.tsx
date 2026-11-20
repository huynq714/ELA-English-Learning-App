import { openURL } from 'expo-linking';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors } from '@/theme/tokens';
import type { Attribution } from '../models/word-provenance';

export function VocabularySources({ entries, playbackNote }: { entries: Attribution[]; playbackNote?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  function open(url: string) {
    setLinkFailed(false);
    void openURL(url).catch(() => setLinkFailed(true));
  }

  const close = () => {
    setExpanded(false);
    setLinkFailed(false);
  };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Nguồn học liệu" accessibilityState={{ expanded }}
      style={styles.toggle} onPress={() => setExpanded(true)}>
      <View style={styles.circle}>
        <AppText size={15} weight="bold" color={colors.primary}>i</AppText>
      </View>
    </Pressable>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={close} />
        <View accessibilityViewIsModal testID="vocabulary-sources-dialog" style={styles.dialog}>
          <View style={styles.header}>
            <AppText accessibilityRole="header" size={21} weight="bold">Nguồn học liệu</AppText>
            <Pressable accessibilityRole="button" style={styles.close} onPress={close}>
              <AppText color={colors.primary} weight="semibold">Đóng</AppText>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.details}>
            {entries.length === 0 && <AppText size={14} color={colors.muted}>Thẻ này chưa có nguồn được xác minh.</AppText>}
            {entries.map(({ role, name, description, url, license, licenseUrl }) => <View key={role} style={styles.entry}>
              <AppText size={14} weight="semibold">{role}</AppText>
              {url ? <Pressable accessibilityRole="link" onPress={() => open(url)}>
                <AppText size={14} color={colors.primary}>{name}</AppText>
              </Pressable> : <AppText size={14} color={colors.muted}>{name}</AppText>}
              {description && <AppText size={14} color={colors.muted}>{description}</AppText>}
              {license && (licenseUrl ? <Pressable accessibilityRole="link" onPress={() => open(licenseUrl)}>
                <AppText size={13} color={colors.primary}>{license}</AppText>
              </Pressable> : <AppText size={13} color={colors.muted}>{license}</AppText>)}
            </View>)}
            {playbackNote && <AppText size={14} color={colors.textSecondary}>{playbackNote}</AppText>}
            {linkFailed && <AppText accessibilityRole="alert" size={13} color={colors.error}>Chưa mở được liên kết nguồn.</AppText>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.6, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: '#18213E66' },
  dialog: { width: '100%', maxWidth: 460, maxHeight: '86%', borderRadius: 20, paddingHorizontal: 18,
    paddingTop: 10, paddingBottom: 16, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 0 },
  details: { gap: 14, paddingVertical: 10 },
  entry: { gap: 4 },
});
