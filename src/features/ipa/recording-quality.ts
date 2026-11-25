export const MAX_RECORDING_MS = 8_000;
const MIN_RECORDING_MS = 350;

export function recordingIssue(uri: string | null, duration: number, levels: readonly number[]) {
  if (!uri || !Number.isFinite(duration) || duration < MIN_RECORDING_MS) {
    return 'Bản ghi quá ngắn hoặc bị lỗi. Hãy ghi lại.';
  }
  if (duration > MAX_RECORDING_MS + 500) return 'Bản ghi quá dài. Hãy ghi lại một từ.';
  if (levels.length && Math.max(...levels) < -42) return 'Âm quá nhỏ. Hãy nói gần mic hơn.';
  if (levels.length >= 5 && levels.filter(level => level >= -1).length > levels.length / 2) {
    return 'Tín hiệu có thể bị quá tải. Hãy lùi xa mic và thử lại.';
  }
  return null;
}
