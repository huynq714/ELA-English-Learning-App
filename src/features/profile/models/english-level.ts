export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type EnglishLevel = typeof levels[number];

export const levelLabels: Record<EnglishLevel, string> = {
  A1: 'Cơ bản',
  A2: 'Sơ cấp',
  B1: 'Trung cấp',
  B2: 'Trung cấp cao',
  C1: 'Nâng cao',
  C2: 'Thành thạo',
};
