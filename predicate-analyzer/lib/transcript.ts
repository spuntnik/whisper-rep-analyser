export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  model: string;
  language?: string;
  duration?: number;
  warning?: string;
}

export interface TranscriptInput {
  text: string;
  segments?: TranscriptSegment[];
}

export function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
