// Static display data transcribed from Figma. No services or persistence.
export const learningSummary = {
  learner: 'Thu Hà', streak: 12, learned: 320, due: 24,
  newWords: 12, learning: 36, mastered: 168,
} as const;

export const decks = [
  { title: 'Công việc', count: 120, purple: false },
  { title: 'Travel', count: 85, purple: false },
  { title: 'Work & Study', count: 64, purple: true },
  { title: 'Food & drinks', count: 72, purple: false },
] as const;

export const journey = {
  word: 'journey', ipa: '/ˈdʒɜːrni/', meaning: 'Hành trình, chuyến đi',
  example: 'I went on a journey, but it was worth it.', current: 5, total: 20,
  // The Figma fill is 75 px in a 331 px track, even though the label is 5/20.
  visualProgress: 75 / 331,
} as const;

export const vowelRows = [
  ['iː', 'ɪ', 'ʊ', 'uː'], ['e', 'ə', 'ɜː', 'ɔː'],
  ['æ', 'ʌ', 'ɑː', 'ɒ'], ['eɪ', 'aɪ', 'ɔɪ', 'əʊ'],
  ['aʊ', 'ɪə', 'eə', 'ʊə'],
] as const;
