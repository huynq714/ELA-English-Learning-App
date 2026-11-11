import { Pressable, StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { useDemoNotice } from '@/components/demo-notice';
import { AppHeader, AppText, Screen, SegmentedControl } from '@/components/ui';
import { vowelRows } from '@/data/demo';
import { colors } from '@/theme/tokens';

export default function IpaScreen() {
  const notice = useDemoNotice();
  return <Screen testID="screen-ipa" header={<AppHeader title="Bảng phiên âm IPA" />}
    footer={<BottomNavigation active="ipa" />} contentStyle={styles.content}>
    <SegmentedControl labels={['Nguyên âm', 'Phụ âm']} selected={0}
      onPress={index => { if (index === 1) notice('Bảng phụ âm'); }} />
    <View style={styles.grid}>
      {vowelRows.map((row, index) => <View key={index} style={styles.row}>
        {row.map(sound => <Pressable key={sound} accessibilityRole="button" accessibilityLabel={`Âm ${sound}`}
          accessibilityState={{ selected: sound === 'ɜː' }} onPress={() => notice(`Chi tiết phát âm ${sound}`)}
          style={[styles.phoneme, sound === 'ɜː' && styles.selected]}>
          <AppText size={25} color={sound === 'ɜː' ? colors.primary : colors.ink}>{sound}</AppText>
        </Pressable>)}
      </View>)}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingHorizontal: 22, paddingBottom: 24, gap: 32 },
  grid: { gap: 16 },
  row: { flexDirection: 'row', gap: 13 },
  phoneme: { flex: 1, minWidth: 0, minHeight: 69, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: colors.screenBorder, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.lavender, borderColor: colors.primary },
});
