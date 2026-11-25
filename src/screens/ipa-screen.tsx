import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { AppHeader, AppText, Screen, SegmentedControl } from '@/components/ui';
import { ipaSounds } from '@/features/ipa/catalogue';
import { colors } from '@/theme/tokens';

export default function IpaScreen() {
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<string>();
  const visible = ipaSounds.filter(sound => (sound.kind === 'consonant') === (tab === 1));
  const rows = Array.from({ length: visible.length / 4 }, (_, index) => visible.slice(index * 4, index * 4 + 4));
  return <Screen testID="screen-ipa" header={<AppHeader title="Bảng phiên âm IPA" />}
    footer={<BottomNavigation active="ipa" />} contentStyle={styles.content}>
    <SegmentedControl labels={['Nguyên âm', 'Phụ âm']} selected={tab} onPress={setTab} />
    <View style={styles.grid}>
      {rows.map((row, index) => <View key={index} style={styles.row}>
        {row.map(sound => <Pressable key={sound.id} accessibilityRole="button" accessibilityLabel={`Âm ${sound.symbol}`}
          accessibilityState={{ selected: selected === sound.id }} onPress={() => {
            setSelected(sound.id);
            router.push({ pathname: '/ipa-detail', params: { sound: sound.id } });
          }} style={[styles.phoneme, selected === sound.id && styles.selected]}>
          <AppText size={25} style={{ fontFamily: undefined }}
            color={selected === sound.id ? colors.primary : colors.ink}>{sound.symbol}</AppText>
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
