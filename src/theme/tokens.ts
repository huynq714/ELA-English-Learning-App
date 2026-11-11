// Values read from the eight original 375 × 844 Figma frames.
export const colors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySurface: '#E8E7FF',
  lavender: '#EEEDFF',
  tabs: '#EFF3FF',
  background: '#F7F8FC',
  screen: '#FAFBFF',
  surface: '#FFFFFF',
  textPrimary: '#1E293B',
  ink: '#18213E',
  textSecondary: '#64748B',
  muted: '#7A8198',
  border: '#E2E8F0',
  screenBorder: '#E8EBF3',
  accentMint: '#2DD4BF',
  mint: '#5DD6B0',
  successSurface: '#E6FAF2',
  success: '#168365',
  warningSurface: '#FFF6DE',
  warning: '#B98416',
  errorSurface: '#FFF0F2',
  error: '#EB6C77',
} as const;

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extrabold: 'Inter-ExtraBold',
} as const;

export const spacing = { screen: 22, form: 24, card: 12, row: 14 } as const;
export const radii = { card: 10, input: 10, social: 12, button: 13, metric: 14 } as const;
