import { Image, type ImageProps } from 'expo-image';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
  type StyleProp, type TextProps, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radii } from '@/theme/tokens';

type FontWeight = keyof typeof fonts;

export function AppText({ size = 15, weight = 'regular', color = colors.ink, style, ...props }:
  TextProps & { size?: number; weight?: FontWeight; color?: string }) {
  return <Text {...props} style={[
    { fontFamily: fonts[weight], fontSize: size, lineHeight: Math.round(size * 1.2), color, includeFontPadding: false },
    style,
  ]} />;
}

// SVGs remain original local Figma exports. Their root geometry is never edited.
export function Asset({ source, width, height = width, style, label }:
  { source: number; width: number; height?: number; style?: ImageProps['style']; label?: string }) {
  return <Image source={source} contentFit="contain" transition={0}
    accessible={!!label} accessibilityLabel={label}
    style={[{ width, height, flexShrink: 0 }, style]} />;
}

export function Screen({ children, header, footer, contentStyle, keyboard = false, testID }:
  PropsWithChildren<{
    header?: ReactNode; footer?: ReactNode; contentStyle?: StyleProp<ViewStyle>;
    keyboard?: boolean; testID: string;
  }>) {
  return <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
    <KeyboardAvoidingView style={styles.safe} behavior={keyboard && Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.screen} testID={testID}>
        {header}
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AppHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return <View style={styles.header}>
    <AppText accessibilityRole="header" size={23} weight="bold" style={styles.grow}>{title}</AppText>
    {trailing}
  </View>;
}

export function PrimaryButton({ title, onPress, style, testID }:
  { title: string; onPress: () => void; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.primary, style, pressed && styles.pressed]}>
    <AppText size={16} weight="semibold" color={colors.surface} style={styles.centerText}>{title}</AppText>
  </Pressable>;
}

export function AppTextInput({ icon, trailing, style, inputStyle, ...props }:
  TextInputProps & { icon: ReactNode; trailing?: ReactNode; style?: StyleProp<ViewStyle>; inputStyle?: TextInputProps['style'] }) {
  return <View style={[styles.inputField, style]}>
    {icon}
    <TextInput {...props} placeholderTextColor={colors.muted} style={[styles.input, inputStyle]} />
    {trailing}
  </View>;
}

export function AppCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ActivityCard({ title, subtitle, icon, chevron, onPress }:
  { title: string; subtitle: string; icon: number; chevron: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.activity, pressed && styles.pressed]}>
    <View style={styles.activityIcon}><Asset source={icon} width={22} /></View>
    <View style={[styles.grow, { gap: 5 }]}>
      <AppText size={15} weight="bold">{title}</AppText>
      <AppText size={12} color={colors.muted} style={{ lineHeight: 16.8 }}>{subtitle}</AppText>
    </View>
    <Asset source={chevron} width={18} />
  </Pressable>;
}

export function SegmentedControl({ labels, selected, onPress }:
  { labels: readonly string[]; selected: number; onPress: (index: number) => void }) {
  return <View style={styles.segments} accessibilityRole="tablist">
    {labels.map((label, i) => <Pressable key={label} accessibilityRole="tab"
      accessibilityState={{ selected: i === selected }} onPress={() => onPress(i)}
      style={[styles.segment, i === selected && styles.segmentSelected]}>
      <AppText size={13} weight="semibold" color={i === selected ? colors.surface : colors.muted}
        style={styles.centerText}>{label}</AppText>
    </Pressable>)}
  </View>;
}

export function ProgressBar({ value }: { value: number }) {
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    style={styles.progressTrack}>
    <View style={[styles.progressValue, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  header: { minHeight: 60, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  primary: { minHeight: 54, padding: 12, width: '100%', backgroundColor: colors.primary,
    borderRadius: radii.button, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  pressed: { opacity: 0.72 },
  inputField: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.screenBorder, borderRadius: radii.input },
  input: { flex: 1, minWidth: 0, padding: 0, fontSize: 15, fontFamily: fonts.regular, color: colors.ink, includeFontPadding: false },
  card: { backgroundColor: colors.surface, borderRadius: radii.card },
  activity: { backgroundColor: colors.surface, minHeight: 66, padding: 12, borderRadius: radii.card,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  activityIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  segments: { minHeight: 43, padding: 4, gap: 4, flexDirection: 'row', backgroundColor: colors.tabs, borderRadius: 10 },
  segment: { flex: 1, minHeight: 35, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.primary },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: colors.screenBorder, overflow: 'hidden' },
  progressValue: { height: 8, borderRadius: 6, backgroundColor: colors.primary },
});
