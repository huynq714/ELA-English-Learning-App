export type IpaAudioSource = 'recorded' | 'tts' | 'unavailable';

export function ipaAudioSource(word: string, recordingUrl?: string): IpaAudioSource {
  if (!word.trim()) return 'unavailable';
  return recordingUrl ? 'recorded' : 'tts';
}
