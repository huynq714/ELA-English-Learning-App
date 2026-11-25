import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type Playback = { key: string; phase: 'loading' | 'playing' | 'error' };

export function useIpaPlayback() {
  const [playback, setPlayback] = useState<Playback | null>(null);
  const generation = useRef(0);
  const release = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    generation.current += 1;
    release.current?.();
    release.current = null;
    void Speech.stop().catch(() => {});
    setPlayback(null);
  }, []);

  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => () => stop(), [stop]);

  async function play(key: string, uri: string) {
    stop();
    const current = generation.current;
    const active = () => generation.current === current;
    setPlayback({ key, phase: 'loading' });
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Speech.stop();
      if (!active()) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
      if (!active()) return;
      player = createAudioPlayer({ uri });
      const owned = player;
      const listener = owned.addListener('playbackStatusUpdate', status => {
        if (!active()) return;
        if (status.error || status.playbackState === 'failed') {
          release.current?.();
          release.current = null;
          setPlayback({ key, phase: 'error' });
        } else if (status.didJustFinish) stop();
        else if (status.playing) {
          clearTimeout(timeout);
          timeout = undefined;
          setPlayback({ key, phase: 'playing' });
        }
      });
      release.current = () => {
        clearTimeout(timeout);
        listener.remove();
        try { owned.pause(); } finally { owned.release(); }
      };
      timeout = setTimeout(() => {
        if (!active()) return;
        release.current?.();
        release.current = null;
        setPlayback({ key, phase: 'error' });
      }, 12_000);
      owned.play();
    } catch {
      if (active()) {
        const cleanup = release.current;
        cleanup?.();
        release.current = null;
        if (player && !cleanup) {
          try { player.release(); } catch { /* Already released. */ }
        }
        setPlayback({ key, phase: 'error' });
      }
    }
  }

  async function speak(key: string, word: string) {
    stop();
    const current = generation.current;
    const active = () => generation.current === current;
    setPlayback({ key, phase: 'loading' });
    try {
      await Speech.stop();
      if (!active()) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
      if (!active()) return;
      const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
      if (!active()) return;
      const voice = voices.find(item => item.language.toLowerCase() === 'en-gb');
      const timeout = setTimeout(() => {
        if (active()) {
          void Speech.stop().catch(() => {});
          setPlayback({ key, phase: 'error' });
        }
      }, 12_000);
      release.current = () => clearTimeout(timeout);
      Speech.speak(word, {
        language: voice?.language ?? 'en-GB',
        ...(voice ? { voice: voice.identifier } : {}),
        useApplicationAudioSession: true,
        onStart: () => {
          clearTimeout(timeout);
          if (active()) setPlayback({ key, phase: 'playing' });
        },
        onDone: () => { if (active()) stop(); },
        onStopped: () => { if (active()) stop(); },
        onError: () => {
          clearTimeout(timeout);
          if (active()) setPlayback({ key, phase: 'error' });
        },
      });
    } catch {
      if (active()) setPlayback({ key, phase: 'error' });
    }
  }

  return { playback, play, speak, stop };
}
