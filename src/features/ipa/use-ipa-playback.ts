import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
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

  return { playback, play, stop };
}
