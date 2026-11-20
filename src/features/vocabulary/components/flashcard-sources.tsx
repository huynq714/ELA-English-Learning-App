import { type Word } from '../models/word';
import { dictionaryRecording, wordAttributions } from '../models/word-provenance';
import { VocabularySources } from './vocabulary-sources';

export function FlashcardSources({ word }: { word: Word }) {
  const recording = dictionaryRecording(word);
  const playbackNote = recording
    ? (word.exampleEn ? 'Câu ví dụ dùng giọng máy.' : undefined)
    : (word.exampleEn ? 'Từ và câu ví dụ dùng giọng máy.' : 'Từ này dùng giọng máy.');
  return <VocabularySources entries={wordAttributions(word)} playbackNote={playbackNote} />;
}
