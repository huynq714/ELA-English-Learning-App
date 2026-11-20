import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioTarget = 'word' | 'example';
type PlaybackState = { cardKey: string; target: AudioTarget; phase: 'loading' | 'playing' | 'error' };
type PlaybackSource = { url: string } | { text: string };

export function useFlashcardAudio(cardKey: string) {
  const [state, setState] = useState<PlaybackState | null>(null);
  const generation = useRef(0);
  const releasePlayer = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    generation.current++;
    const release = releasePlayer.current;
    releasePlayer.current = null;
    release?.();
    return Speech.stop().catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => () => {
    void stop();
    setState(null);
  }, [stop]));
  useEffect(() => () => { void stop(); }, [cardKey, stop]);

  function stopPlayback() {
    void stop();
    setState(null);
  }

  async function play(target: AudioTarget, source: PlaybackSource) {
    const stopping = stop();
    const current = generation.current;
    const isCurrent = () => current === generation.current;
    const update = (phase: PlaybackState['phase'] | null) => {
      if (isCurrent()) setState(phase ? { cardKey, target, phase } : null);
    };
    const finish = (phase: 'error' | null) => {
      if (!isCurrent()) return;
      update(phase);
      void stop();
    };

    update('loading');
    try {
      await stopping;
      if (!isCurrent()) return;
      // Use the same playback session for recordings and iOS text-to-speech.
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      if (!isCurrent()) return;
      if ('text' in source) {
        Speech.speak(source.text, {
          language: 'en-US',
          useApplicationAudioSession: true,
          onStart: () => update('playing'),
          onDone: () => update(null),
          onStopped: () => update(null),
          onError: () => finish('error'),
        });
        return;
      }

      const player = createAudioPlayer({ uri: source.url });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const watchLoading = () => {
        update('loading');
        timer ??= setTimeout(() => finish('error'), 12_000);
      };
      const listener = player.addListener('playbackStatusUpdate', status => {
        if (!isCurrent()) return;
        if (status.error || status.playbackState === 'failed') finish('error');
        else if (status.didJustFinish) finish(null);
        else if (status.playing) {
          clearTimeout(timer);
          timer = undefined;
          update('playing');
        } else if (status.isBuffering) watchLoading();
      });
      releasePlayer.current = () => {
        clearTimeout(timer);
        listener.remove();
        try {
          player.pause();
        } finally {
          player.release();
        }
      };
      watchLoading();
      player.play();
    } catch {
      finish('error');
    }
  }

  return { playback: state?.cardKey === cardKey ? state : null, play, stopPlayback };
}
