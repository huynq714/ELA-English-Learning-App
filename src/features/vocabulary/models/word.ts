export interface Word {
  id: string;
  headword: string;
  partOfSpeech: string | null;
  cefrLevel: string | null;
  definitionEn: string | null;
  meaningVi: string | null;
  ipa: string | null;
  exampleEn: string | null;
  exampleVi: string | null;
  audioUrl: string | null;
  sourceMetadata: Record<string, unknown>;
}

export function parseWord(value: unknown): Word {
  if (!value || typeof value !== 'object') throw new Error('Backend returned an invalid word.');
  const word = value as Record<string, unknown>;
  const optionalString = (key: string) => word[key] === null || typeof word[key] === 'string';
  if (typeof word.id !== 'string' || typeof word.headword !== 'string'
    || !optionalString('partOfSpeech') || !optionalString('cefrLevel')
    || !optionalString('definitionEn') || !optionalString('meaningVi')
    || !optionalString('ipa') || !optionalString('exampleEn') || !optionalString('audioUrl')
    || (word.exampleVi !== undefined && !optionalString('exampleVi'))
    || !word.sourceMetadata || typeof word.sourceMetadata !== 'object') {
    throw new Error('Backend returned a word with an invalid shape.');
  }
  return { ...(word as unknown as Omit<Word, 'exampleVi'>), exampleVi: typeof word.exampleVi === 'string' ? word.exampleVi : null };
}
