import { verifiedVietnamese, type Word } from './word';

const dictionary = 'Free Dictionary API';
const cefr = 'CEFR-J Wordlist v1.6';
const cefrUrl = 'https://cefr-j.org/download_eng';
const compiler = 'Yukio Tono – Tokyo University of Foreign Studies';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sourceUrl(value: unknown, hosts: readonly string[]): string | undefined {
  if (typeof value !== 'string' || !/^https:\/\/[^\s\\]+$/i.test(value)) return;
  const host = /^https:\/\/([^/?#]+)(?=[/?#]|$)/i.exec(value)?.[1].toLowerCase();
  if (host && hosts.includes(host)) return value;
}

const englishHosts = ['api.dictionaryapi.dev', 'en.wiktionary.org'];
const wiktionaryHosts = ['vi.wiktionary.org', 'en.wiktionary.org'];
const creditHosts = ['commons.wikimedia.org', 'en.wiktionary.org'];
const licenseHosts = ['creativecommons.org', 'www.creativecommons.org', ...wiktionaryHosts];

export interface Attribution {
  role: string;
  name: string;
  description?: string;
  url?: string;
  license?: string;
  licenseUrl?: string;
}

export const catalogueAttributions: Attribution[] = [
  { role: 'Danh mục từ vựng', name: cefr, description: compiler, url: cefrUrl },
  { role: 'Định nghĩa tiếng Anh và phiên âm IPA', name: dictionary,
    description: 'Nguồn của các mục có dẫn chứng từ API. Một số mục dẫn trực tiếp đến Wiktionary tiếng Anh.',
    url: 'https://dictionaryapi.dev/' },
  { role: 'Nghĩa tiếng Việt', name: 'Wiktionary tiếng Việt',
    description: 'Đối chiếu nghĩa theo mục từ. Một số mục dùng bản dịch từ Wiktionary tiếng Anh.',
    url: 'https://vi.wiktionary.org/' },
  { role: 'Bản ghi phát âm', name: 'Free Dictionary API · Wikimedia',
    description: 'Xem nguồn bản ghi và giấy phép riêng trên từng thẻ có audio.' },
];

export function dictionaryRecording(word: Word) {
  const metadata = record(record(word.sourceMetadata.pronunciation).audio);
  const url = sourceUrl(metadata.audioUrl, ['api.dictionaryapi.dev', 'upload.wikimedia.org']);
  const creditUrl = sourceUrl(metadata.url, creditHosts);
  const licenseUrl = sourceUrl(metadata.licenseUrl, licenseHosts);
  const license = string(metadata.license);
  const apiUrl = sourceUrl(metadata.apiUrl, ['api.dictionaryapi.dev']);
  const author = string(metadata.author);
  if (metadata.source !== dictionary || !url || word.audioUrl !== url || !creditUrl || !license || !licenseUrl || !apiUrl) {
    return null;
  }
  return { url, creditUrl, license, licenseUrl, author, accent: string(metadata.accent) };
}

function dictionaryName(url: string) {
  return sourceUrl(url, ['api.dictionaryapi.dev']) ? dictionary : 'Wiktionary tiếng Anh';
}

export function wordAttributions(word: Word): Attribution[] {
  const result: Attribution[] = [];
  const metadata = word.sourceMetadata;
  const list = record(metadata.cefrj);
  if (list.version === '1.6' && list.url === cefrUrl && list.compiler === 'Yukio Tono, Tokyo University of Foreign Studies') {
    result.push({ role: 'Danh mục từ vựng', name: cefr, description: compiler, url: cefrUrl });
  }
  const definition = record(metadata.dictionary);
  const definitionUrl = sourceUrl(definition.url, englishHosts);
  if (word.definitionEn && definitionUrl && definition.posMatch === true) {
    result.push({ role: 'Định nghĩa tiếng Anh', name: dictionaryName(definitionUrl), url: definitionUrl,
      license: string(definition.license), licenseUrl: sourceUrl(definition.licenseUrl, licenseHosts) });
  }
  const vietnamese = record(metadata.vietnamese);
  const viUrl = sourceUrl(vietnamese.url, wiktionaryHosts);
  if (verifiedVietnamese(word) && viUrl) {
    const name = sourceUrl(viUrl, ['vi.wiktionary.org']) ? 'Wiktionary tiếng Việt' : 'Wiktionary tiếng Anh';
    result.push({ role: 'Nghĩa tiếng Việt', name, url: viUrl, license: string(vietnamese.license),
      licenseUrl: sourceUrl(vietnamese.licenseUrl, licenseHosts) });
  }
  const phonetic = record(record(metadata.pronunciation).ipa);
  const phoneticUrl = sourceUrl(phonetic.url, englishHosts);
  if (word.ipa && phonetic.text === word.ipa && phoneticUrl) {
    result.push({ role: 'Phiên âm IPA', name: dictionaryName(phoneticUrl), url: phoneticUrl });
  }
  const examples = record(metadata.examples);
  if (word.exampleEn && examples.english === 'English Learning App (original example)') {
    result.push({ role: 'Câu ví dụ', name: 'English Learning App', description: 'Câu ví dụ do ứng dụng biên soạn.' });
  } else if (word.exampleEn && examples.english === dictionary) {
    const exampleUrl = sourceUrl(examples.englishUrl, ['api.dictionaryapi.dev']);
    if (exampleUrl) result.push({ role: 'Câu ví dụ', name: dictionary, url: exampleUrl });
  }
  const audio = dictionaryRecording(word);
  if (audio) {
    result.push({ role: 'Bản ghi phát âm', name: audio.accent ? `${dictionary} (${audio.accent})` : dictionary,
      url: audio.creditUrl, description: audio.author, license: audio.license, licenseUrl: audio.licenseUrl });
  }
  return result;
}
