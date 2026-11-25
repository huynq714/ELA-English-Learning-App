import { router, useLocalSearchParams } from 'expo-router';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { AppCard, AppHeader, AppText, Asset, PrimaryButton, Screen } from '@/components/ui';
import { findIpaSound, type IpaExample, type IpaSound } from '@/features/ipa/catalogue';
import { ipaIllustrations } from '@/features/ipa/illustrations';
import { ipaWordAudio } from '@/features/ipa/word-audio';
import { useIpaPlayback } from '@/features/ipa/use-ipa-playback';
import { useIpaRecording } from '@/features/ipa/use-ipa-recording';
import { figmaAssets } from '@/theme/figma-assets';
import { colors } from '@/theme/tokens';

function Back({ title }: { title: string }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => {
      if (router.canGoBack()) router.back();
      else router.replace('/ipa');
    }} style={styles.icon}>
      <AppText size={25}>‹</AppText>
    </Pressable>
    <AppHeader title={title} />
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
  const loading = audio.playback?.key === word && audio.playback.phase === 'loading';
  const playing = audio.playback?.key === word && audio.playback.phase === 'playing';
  return <View style={styles.audioGroup}>
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? `Nghe phát âm ${word}`}
      disabled={!recording} style={[styles.audioButton, !recording && styles.disabled]}
      onPress={() => {
        if (!recording) return;
        if (playing || loading) audio.stop();
        else void audio.play(word, recording.url);
      }}>
      {loading || playing ? <AppText color={colors.primary} size={18}>{loading ? '…' : '■'}</AppText>
        : <Asset source={figmaAssets.flashcard.volume2} width={20} style={{ tintColor: colors.primary }} />}
    </Pressable>
    {recording && recording.accent !== 'en-GB'
      && <AppText size={10} color={colors.muted}>{recording.accent === 'unknown' ? 'Chưa rõ giọng' : recording.accent}</AppText>}
    {!recording && <AppText size={12} color={colors.muted}>Chưa có audio</AppText>}
    {audio.playback?.key === word && audio.playback.phase === 'error'
      && <AppText accessibilityRole="alert" size={12} color={colors.error}>Không phát được audio.</AppText>}
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
  const illustration = ipaIllustrations[sound.id as keyof typeof ipaIllustrations];
  const sample = sound.examples.find(item => {
    const recording = ipaWordAudio[item.word];
    return recording?.ipa.includes(sound.symbol) || (recording?.accent === 'en-GB' && sound.kind === 'consonant');
  });
  return <Screen testID="screen-ipa-detail" header={<Back title="Chi tiết âm" />} contentStyle={styles.content}>
    <View style={styles.center}>
      <AppText size={57} weight="extrabold" style={styles.ipa}>/{sound.symbol}/</AppText>
      {sample ? <View style={styles.center}>
        <SampleAudio word={sample.word} audio={audio} label={`Nghe từ mẫu ${sample.word} có âm ${sound.symbol}`} />
        <AppText size={12} color={colors.muted}>Nghe từ mẫu “{sample.word}” có âm /{sound.symbol}/</AppText>
      </View> : <AppText color={colors.muted}>Chưa có bản ghi âm mẫu đã xác minh.</AppText>}
    </View>
    {illustration && <View style={styles.center}>
      <Image source={illustration.source} style={styles.illustration} resizeMode="contain"
        accessibilityLabel={illustration.caption} />
      <AppText size={12} color={colors.muted}>{illustration.caption}</AppText>
    </View>}
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
    <Pressable accessibilityRole="button" style={styles.link} onPress={() => setShowSources(true)}>
      <AppText size={12} color={colors.primary}>Nguồn ảnh và bản ghi âm ⓘ</AppText>
    </Pressable>
    <Modal visible={showSources} transparent animationType="fade" onRequestClose={() => setShowSources(false)}>
      <View style={styles.modalBackdrop}>
        <AppCard style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.credits}>
            <AppText size={18} weight="bold">Nguồn học liệu</AppText>
            {illustration && <View style={styles.credits}>
              <AppText weight="semibold">Minh họa khẩu hình</AppText>
              <AppText size={12}>{illustration.author || 'Wikimedia Commons'} · {illustration.license}</AppText>
              <AppText size={11} selectable>{illustration.credit}</AppText>
              <AppText size={11} selectable>{illustration.licenseUrl}</AppText>
            </View>}
            {sound.examples.filter(item => ipaWordAudio[item.word]).map(item => {
              const source = ipaWordAudio[item.word];
              return <View key={item.word} style={styles.credits}>
                <AppText weight="semibold">Audio: {item.word}</AppText>
                <AppText size={12}>{source.author} · {source.license} · {source.accent}</AppText>
                <AppText size={11} selectable>{source.credit}</AppText>
                <AppText size={11} selectable>{source.licenseUrl}</AppText>
              </View>;
            })}
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
    pathname: '/ipa-result', params: { sound: sound.id, word: example.word, invalid: take?.issue ? '1' : '0' },
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
  const { invalid } = useLocalSearchParams<{ invalid?: string }>();
  const audio = useIpaPlayback();
  if (!sound || !example) return <MissingLesson />;
  const unassessable = invalid === '1';
  return <Screen testID="screen-ipa-result" header={<Back title="Kết quả phát âm" />}
    contentStyle={[styles.content, styles.practice]}>
    <Word example={example} sound={sound} audio={audio} />
    <View style={styles.center}>
      <AppText size={42} weight="extrabold" color={colors.primary}>—</AppText>
      <AppText color={colors.muted}>UNASSESSABLE · {unassessable ? 'Bản ghi không hợp lệ' : 'Chấm điểm chưa khả dụng'}</AppText>
    </View>
    <AppCard style={styles.panel}>
      <AppText weight="bold">Nhận xét</AppText>
      <AppText>{unassessable ? 'Hãy quay lại và ghi âm một từ rõ ràng trong môi trường yên tĩnh.'
        : 'Bạn có thể nghe lại bản ghi. Tính năng chấm phát âm đang chờ kiểm chứng.'}</AppText>
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
  illustration: { width: 230, height: 240, backgroundColor: colors.surface, borderRadius: 18 },
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
