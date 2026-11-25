import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { MAX_RECORDING_MS, recordingIssue } from './recording-quality';

type Take = { uri: string | null; issue: string | null };
type Phase = 'idle' | 'starting' | 'recording' | 'stopping';

export function useIpaRecording(stopPlayback: () => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [phase, setPhase] = useState<Phase>('idle');
  const [take, setTake] = useState<Take | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentPhase = useRef<Phase>('idle');
  const lifecycle = useRef(0);
  const started = useRef(0);
  const levels = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const change = (next: Phase) => {
    currentPhase.current = next;
    setPhase(next);
  };

  useFocusEffect(useCallback(() => () => {
    lifecycle.current++;
    clearTimer();
    if (currentPhase.current === 'recording') {
      void recorder.stop().catch(() => {}).finally(() => {
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      });
    }
    currentPhase.current = 'idle';
    setPhase('idle');
  }, [clearTimer, recorder]));

  async function stop() {
    if (currentPhase.current !== 'recording') return;
    const run = lifecycle.current;
    clearTimer();
    change('stopping');
    const duration = Date.now() - started.current;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (run === lifecycle.current) setTake({ uri, issue: recordingIssue(uri, duration, levels.current) });
    } catch {
      if (run === lifecycle.current) setTake({ uri: null, issue: 'Không đọc được bản ghi. Hãy thử lại.' });
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (run === lifecycle.current) change('idle');
    }
  }

  async function record() {
    if (currentPhase.current !== 'idle') return;
    change('starting');
    const run = lifecycle.current;
    setError(null);
    try {
      stopPlayback();
      const permission = await requestRecordingPermissionsAsync();
      if (run !== lifecycle.current) return;
      if (!permission.granted) {
        setError(permission.canAskAgain ? 'Cần cấp quyền micro để ghi âm.' : 'Hãy bật quyền micro trong cài đặt thiết bị.');
        change('idle');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (run !== lifecycle.current) {
        await recorder.stop().catch(() => {});
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
      setTake(null);
      started.current = Date.now();
      levels.current = [];
      change('recording');
      timer.current = setInterval(() => {
        try {
          const { metering } = recorder.getStatus();
          if (typeof metering === 'number' && Number.isFinite(metering)) levels.current.push(metering);
        } catch {
          // Duration is still enforced if the platform cannot provide metering.
        }
        if (Date.now() - started.current >= MAX_RECORDING_MS) void stop();
      }, 100);
    } catch {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (run === lifecycle.current) {
        setError('Không thể bắt đầu ghi âm. Hãy kiểm tra micro rồi thử lại.');
        change('idle');
      }
    }
  }

  return { phase, take, error, record, stop };
}
