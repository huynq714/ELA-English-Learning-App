import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { AppCard, AppHeader, AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { findIpaSound, type IpaExample, type IpaSound } from '@/features/ipa/catalogue';
import { ipaAudioSource } from '@/features/ipa/audio-source';
import { ipaWordAudio } from '@/features/ipa/word-audio';
import { useIpaPlayback } from '@/features/ipa/use-ipa-playback';
import { useIpaRecording } from '@/features/ipa/use-ipa-recording';
import { ipaReferenceRepository, type IpaReferenceResult } from '@/features/ipa/ipa-reference-repository';
import { useSession } from '@/features/auth/view-model/session-context';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

function Back({ title, onInfo }: { title: string; onInfo?: () => void }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => {
      if (router.canGoBack()) router.back();
      else router.replace('/ipa');
    }} style={styles.icon}>
      <AppText size={25}>‹</AppText>
    </Pressable>
    <AppHeader title={title} />
    {onInfo && <Pressable accessibilityRole="button" accessibilityLabel="Thông tin nguồn IPA"
      style={styles.info} onPress={onInfo}><AppText color={colors.primary} size={24}>ⓘ</AppText></Pressable>}
  </View>;
}

function useLesson() {
  const params = useLocalSearchParams<{ sound?: string; word?: string }>();
  const sound = findIpaSound(params.sound);
  const example = params.word === undefined ? sound?.examples[0] : sound?.examples.find(item => item.word === params.word);
  return { sound, example };
}

type AudioController = ReturnType<typeof useIpaPlayback>;

function SampleAudio({ word, audio, label }: { word: string; audio: AudioController; label?: string }) {
  const recording = ipaWordAudio[word];
  const source = ipaAudioSource(word, recording?.url);
  const loading = audio.playback?.key === word && audio.playback.phase === 'loading';
  const playing = audio.playback?.key === word && audio.playback.phase === 'playing';
  return <View style={styles.audioGroup}>
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? `Nghe phát âm ${word} (${source === 'tts' ? 'giọng máy TTS' : source === 'recorded' ? 'bản ghi' : 'không khả dụng'})`}
      disabled={source === 'unavailable'} style={[styles.audioButton, source === 'unavailable' && styles.disabled]}
      onPress={() => {
        if (playing || loading) audio.stop();
        else if (source === 'recorded' && recording) void audio.play(word, recording.url);
        else if (source === 'tts') void audio.speak(word, word);
      }}>
      {loading || playing ? <AppText color={colors.primary} size={18}>{loading ? '…' : '■'}</AppText>
        : <Asset source={figmaAssets.flashcard.volume2} width={20} style={{ tintColor: colors.primary }} />}
    </Pressable>
    <AppText size={10} color={colors.muted}>{source === 'tts' ? Platform.OS === 'ios' ? 'Giọng máy (TTS) · tắt im lặng' : 'Giọng máy (TTS)' : source === 'unavailable' ? 'Không có audio' : recording?.accent === 'en-GB' ? 'Bản ghi · en-GB' : recording?.accent === 'unknown' ? 'Bản ghi · chưa rõ giọng' : `Bản ghi · ${recording?.accent}`}</AppText>
    {audio.playback?.key === word && audio.playback.phase === 'error'
      && <AppText accessibilityRole="alert" size={12} color={colors.error}>
        {source === 'tts' && Platform.OS === 'ios'
          ? 'Không phát được TTS. Hãy tắt chế độ im lặng trên iPhone rồi thử lại.'
          : 'Không phát được audio. Hãy thử lại.'}
      </AppText>}
  </View>;
}

function MissingLesson() {
  return <Screen testID="ipa-lesson-not-found" header={<Back title="IPA" />} contentStyle={styles.content}>
    <AppText>Không tìm thấy bài luyện.</AppText>
    <PrimaryButton title="Quay về IPA" onPress={() => router.replace('/ipa')} />
  </Screen>;
}

function Word({ example, sound, audio, showAudio = true }: { example: IpaExample; sound: IpaSound; audio: AudioController; showAudio?: boolean }) {
  return <View style={styles.center}>
    <AppText size={32} weight="extrabold">{example.word}</AppText>
    <AppText size={19} style={styles.ipa} color={colors.muted}>/{example.ipa}/</AppText>
    <AppText size={13} style={styles.ipa} color={colors.muted}>Âm mục tiêu /{sound.symbol}/</AppText>
    {showAudio && <SampleAudio word={example.word} audio={audio} />}
  </View>;
}

export function IpaDetailScreen() {
  const { sound } = useLesson();
  const audio = useIpaPlayback();
  const [showSources, setShowSources] = useState(false);
  if (!sound) return <MissingLesson />;
  const soundType = sound.kind === 'consonant' ? 'Phụ âm' : sound.kind === 'diphthong' ? 'Nguyên âm đôi' : 'Nguyên âm đơn';
  return <Screen testID="screen-ipa-detail" header={<Back title="Chi tiết âm" onInfo={() => setShowSources(true)} />}
    contentStyle={styles.content}>
    <View style={styles.center}>
      <AppText size={57} weight="extrabold" style={styles.ipa}>/{sound.symbol}/</AppText>
      <AppText color={colors.muted}>{soundType}</AppText>
    </View>
    <AppCard style={styles.panel}>
      <AppText size={18} weight="bold">Cách phát âm</AppText>
      <AppText>{sound.guidance}</AppText>
    </AppCard>
    <AppText size={18} weight="bold">Ví dụ</AppText>
    {sound.examples.map(example => <AppCard key={example.word} style={styles.example}>
      <View style={styles.exampleText}>
        <AppText weight="semibold">{example.word}</AppText>
        <AppText size={14} color={colors.muted} style={styles.ipa}>/{example.ipa}/</AppText>
      </View>
      <SampleAudio word={example.word} audio={audio} />
      <Pressable accessibilityRole="button" accessibilityLabel={'Luyện ' + example.word} style={styles.link} onPress={() =>
        router.push({ pathname: '/ipa-practice', params: { sound: sound.id, word: example.word } })}>
        <AppText color={colors.primary}>Luyện</AppText>
      </Pressable>
    </AppCard>)}
    <Modal visible={showSources} transparent animationType="fade" onRequestClose={() => setShowSources(false)}>
      <View style={styles.modalBackdrop}>
        <AppCard style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.credits}>
            <AppText size={18} weight="bold">Nguồn học liệu</AppText>
            <AppText size={12}>Bảng âm tham chiếu British Council Sounds Right. Hướng dẫn tiếng Việt do ứng dụng biên soạn; phiên âm ví dụ theo tiếng Anh Anh.</AppText>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.britishcouncil.org/english/business/apps/sounds-right').catch(() => {})}>
              <AppText size={12} color={colors.primary}>British Council Sounds Right ↗</AppText>
            </Pressable>
            {sound.examples.filter(item => ipaWordAudio[item.word]).map(item => {
              const source = ipaWordAudio[item.word];
              return <View key={item.word} style={styles.credits}>
                <AppText weight="semibold">Audio: {item.word}</AppText>
                <AppText size={12}>{source.author} · {source.license} · {source.accent}</AppText>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(source.credit).catch(() => {})}>
                  <AppText size={11} color={colors.primary}>{source.credit} ↗</AppText>
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(source.licenseUrl).catch(() => {})}>
                  <AppText size={11} color={colors.primary}>{source.licenseUrl} ↗</AppText>
                </Pressable>
              </View>;
            })}
            {sound.examples.some(item => ipaAudioSource(item.word, ipaWordAudio[item.word]?.url) === 'tts')
              && <AppText size={12}>Các từ chưa có bản ghi dùng giọng máy TTS của thiết bị. TTS không phải bản ghi từ điển và giọng thực tế phụ thuộc thiết bị.</AppText>}
          </ScrollView>
          <Pressable accessibilityRole="button" style={styles.link} onPress={() => setShowSources(false)}>
            <AppText weight="semibold" color={colors.primary}>Đóng</AppText>
          </Pressable>
        </AppCard>
      </View>
    </Modal>
    <PrimaryButton title="Luyện phát âm" onPress={() =>
      router.push({ pathname: '/ipa-practice', params: { sound: sound.id, word: sound.examples[0].word } })} />
  </Screen>;
}

export function IpaPracticeScreen() {
  const { sound, example } = useLesson();
  const audio = useIpaPlayback();
  const recording = useIpaRecording(audio.stop);
  const { take, phase, error } = recording;
  const busy = phase === 'starting' || phase === 'stopping';
  if (!sound || !example) return <MissingLesson />;
  const openResult = () => router.push({
    pathname: '/ipa-result', params: { sound: sound.id, word: example.word, invalid: take?.issue ? '1' : '0', audioUri: take?.uri ?? '' },
  });
  return <Screen testID="screen-ipa-practice" header={<Back title="Luyện phát âm" />}
    contentStyle={[styles.content, styles.practice]}>
    <Word example={example} sound={sound} audio={audio} showAudio={phase === 'idle'} />
    <View style={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={phase === 'recording' ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
        disabled={busy} style={[styles.mic, busy && styles.disabled]} onPress={() =>
          void (phase === 'recording' ? recording.stop() : recording.record())}>
        {phase === 'recording' ? <AppText size={30} color={colors.surface}>■</AppText>
          : <Asset source={figmaAssets.ipa.mic} width={36} style={{ tintColor: colors.surface }} />}
      </Pressable>
      <AppText color={colors.muted}>{phase === 'recording' ? 'Đang ghi âm · nhấn để dừng'
        : busy ? 'Đang xử lý…' : take ? 'Nhấn để ghi lại' : 'Nhấn để ghi âm'}</AppText>
      {(error || take?.issue) && <AppText accessibilityRole="alert" color={colors.error}>{error || take?.issue}</AppText>}
      {audio.playback?.key === 'take' && audio.playback.phase === 'error'
        && <AppText accessibilityRole="alert" color={colors.error}>Không phát được bản ghi.</AppText>}
      {take?.uri && phase === 'idle' && <Pressable accessibilityRole="button" style={styles.link} onPress={() => {
        if (!take.uri) return;
        if (audio.playback?.key === 'take' && (audio.playback.phase === 'playing' || audio.playback.phase === 'loading')) audio.stop();
        else void audio.play('take', take.uri);
      }}>
        <AppText color={colors.primary}>{audio.playback?.key === 'take' && (audio.playback.phase === 'playing' || audio.playback.phase === 'loading')
          ? 'Dừng phát' : 'Nghe lại bản ghi'}</AppText>
      </Pressable>}
    </View>
    {take && phase === 'idle' && <PrimaryButton title="Xem kết quả bản ghi" onPress={openResult} />}
  </Screen>;
}

export function IpaResultScreen() {
  const { sound, example } = useLesson();
  const { invalid, audioUri } = useLocalSearchParams<{ invalid?: string; audioUri?: string }>();
  const audio = useIpaPlayback();
  const session = useSession();
  const soundId = sound?.id;
  const targetWord = example?.word;
  const authenticate = session.authenticated;
  const [assessment, setAssessment] = useState<IpaReferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!soundId || !targetWord || invalid === '1' || !audioUri) return;
    let active = true;
    void authenticate(token => ipaReferenceRepository.assess(token, audioUri, targetWord))
      .then(result => { if (active) setAssessment(result); })
      .catch(() => { if (active) setError('Không kết nối được dịch vụ chấm tham khảo. Hãy thử lại.'); });
    return () => { active = false; };
  }, [soundId, targetWord, invalid, audioUri, authenticate]);
  if (!sound || !example) return <MissingLesson />;
  const unassessable = invalid === '1';
  const loading = Boolean(audioUri && !unassessable && !assessment && !error);
  const hasReference = !unassessable && assessment?.status === 'REFERENCE' && assessment.reliable === true
    && typeof assessment.score === 'number' && Number.isFinite(assessment.score)
    && assessment.score >= 0 && assessment.score <= 100;
  return <Screen testID="screen-ipa-result" header={<Back title="Kết quả phát âm" />}
    contentStyle={[styles.content, styles.practice]}>
    <Word example={example} sound={sound} audio={audio} />
    <View style={styles.center}>
      {hasReference ? <>
        <AppText size={42} weight="extrabold" color={colors.primary}>{Math.round(assessment.score!)}/100</AppText>
        <AppText color={colors.muted}>Điểm tham khảo, chưa dùng để xét hoàn thành</AppText>
      </> : <>
        <AppText size={42} weight="extrabold" color={colors.muted}>—</AppText>
        <AppText color={colors.muted}>{loading ? 'Đang phân tích bản ghi…' : `UNASSESSABLE · ${unassessable ? 'Bản ghi không hợp lệ' : assessment?.reasons?.join(', ') || error || 'Kết quả chưa đáng tin cậy'}`}</AppText>
      </>}
    </View>
    <AppCard style={styles.panel}>
      <AppText weight="bold">Nhận xét</AppText>
      <AppText>{hasReference
        ? `Hệ thống nghe được: ${assessment.heardText || example.word}. Đây chỉ là phản hồi tham khảo, không ảnh hưởng tiến độ học.`
        : 'Bản ghi không được lưu hoặc tính là hoàn thành. Hãy kiểm tra âm thanh rồi thu lại.'}</AppText>
      {hasReference && assessment.differences?.errors?.flatMap(error => error.phones ?? []).length
        ? <AppText size={13} color={colors.muted}>Âm cần nghe lại: {assessment.differences.errors
          .flatMap(error => error.phones ?? []).map(phone => `${phone.expected ?? '?'} → ${phone.heard ?? '?'}`).join(' · ')}</AppText>
        : null}
    </AppCard>
    <PrimaryButton title="Luyện lại" onPress={() => {
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/ipa-practice', params: { sound: sound.id, word: example.word } });
    }} />
    <Pressable accessibilityRole="button" style={[styles.link, styles.return]} onPress={() => router.dismissTo('/ipa')}>
      <AppText weight="semibold" color={colors.primary}>Quay về IPA</AppText>
    </Pressable>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  icon: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 22, gap: 16 },
  practice: { flexGrow: 1, justifyContent: 'space-evenly' },
  center: { alignItems: 'center', gap: 10 },
  info: { marginLeft: 'auto', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  audioGroup: { alignItems: 'center' },
  credits: { gap: 4, paddingTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
  modalCard: { maxHeight: '70%', padding: 18, gap: 12 },
  audioButton: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.lavender,
    alignItems: 'center', justifyContent: 'center' },
  ipa: { fontFamily: undefined },
  panel: { padding: 16, gap: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
  example: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  exampleText: { flex: 1, gap: 4 },
  mic: { backgroundColor: colors.primary, borderWidth: 8, borderColor: colors.lavender,
    height: 124, width: 124, borderRadius: 62, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  return: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 13 },
});
