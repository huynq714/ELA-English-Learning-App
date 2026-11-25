import assert from 'node:assert/strict';
import test from 'node:test';
import { ipaSounds, findIpaSound } from '../src/features/ipa/catalogue.ts';
import { recordingIssue } from '../src/features/ipa/recording-quality.ts';
import { ipaWordAudio } from '../src/features/ipa/word-audio.ts';
import { ipaAudioSource } from '../src/features/ipa/audio-source.ts';


test('44 unique British English sounds with stable routes and two relevant examples each', () => {
  assert.equal(ipaSounds.length, 44);
  assert.equal(ipaSounds.filter(sound => sound.kind === 'monophthong').length, 12);
  assert.equal(ipaSounds.filter(sound => sound.kind === 'diphthong').length, 8);
  assert.equal(ipaSounds.filter(sound => sound.kind === 'consonant').length, 24);
  assert.equal(new Set(ipaSounds.map(sound => sound.id)).size, 44);
  assert.equal(new Set(ipaSounds.map(sound => sound.symbol)).size, 44);
  for (const sound of ipaSounds) {
    assert.equal(findIpaSound(sound.id), sound);
    assert.equal(new Set(sound.examples.map(example => example.word)).size, 2);
    assert.ok(sound.guidance.trim());
    for (const { ipa } of sound.examples) assert.ok(ipa.includes(sound.symbol), ipa);
  }
  assert.equal(findIpaSound('unknown'), undefined);
});

test('recorded example audio has HTTPS media, source, license and honest accent metadata', () => {
  assert.ok(Object.keys(ipaWordAudio).length > 0);
  for (const [word, item] of Object.entries(ipaWordAudio)) {
    assert.match(item.url, /^https:\/\/upload\.wikimedia\.org\/.+\.mp3$/);
    assert.match(item.credit, /^https:\/\/commons\.wikimedia\.org\//);
    assert.ok(['en-GB', 'en-US', 'en-AU', 'unknown'].includes(item.accent), word);
    assert.ok(item.author.trim() && !/assumed/i.test(item.author), word);
    assert.match(item.license, /^CC(?:0| BY)/);
    assert.match(item.licenseUrl, /^https:\/\/creativecommons\.org\//);
  }
});

test('all 88 IPA examples declare recorded, TTS or unavailable without relabeling recordings', () => {
  const examples = ipaSounds.flatMap(sound => sound.examples);
  const counts = { recorded: 0, tts: 0, unavailable: 0 };
  for (const example of examples) {
    const source = ipaAudioSource(example.word, ipaWordAudio[example.word]?.url);
    counts[source] += 1;
    assert.equal(source === 'recorded', Boolean(ipaWordAudio[example.word]?.url));
  }
  assert.equal(examples.length, 88);
  assert.deepEqual(counts, { recorded: 37, tts: 51, unavailable: 0 });
  assert.equal(ipaAudioSource(' '), 'unavailable');
});

test('recording checks reject missing, short, long, quiet and overloaded signals', () => {
  assert.ok(recordingIssue(null, 1000, []));
  assert.ok(recordingIssue('file', 100, []));
  assert.ok(recordingIssue('file', 9000, []));
  assert.ok(recordingIssue('file', 1000, [-66, -52, -49]));
  assert.ok(recordingIssue('file', 1000, [-1, 0, 0, -2, -1]));
  assert.equal(recordingIssue('file', 1000, [-14, -22, -38]), null);
  assert.equal(recordingIssue('file', 1000, []), null);
});
