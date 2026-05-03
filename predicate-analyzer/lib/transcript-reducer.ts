import type {
  LiveTranscriptSegment,
  RealtimeTranscriptEvent,
  RealtimeTranscriptState,
} from "@/lib/realtime/types";

function mergeText(base: string, addition: string) {
  const left = base.trim();
  const right = addition.trim();
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  if (left.endsWith(right)) return left;
  if (right.startsWith(left)) return right;
  return `${left} ${right}`.trim();
}

function updatePartialSegments(
  segments: LiveTranscriptSegment[],
  event: RealtimeTranscriptEvent,
  partialText: string,
) {
  const stableSegments = segments.filter((segment) => !segment.isPartial);
  const partialSegment: LiveTranscriptSegment = {
    start: typeof event.start === "number" ? event.start : stableSegments.length * 4,
    end:
      typeof event.end === "number"
        ? event.end
        : (typeof event.start === "number" ? event.start : stableSegments.length * 4) + 4,
    text: partialText,
    speaker: event.speaker,
    itemId: event.itemId,
    isPartial: true,
  };

  return [...stableSegments, partialSegment];
}

export function createInitialTranscriptState(): RealtimeTranscriptState {
  return {
    connectionState: "idle",
    transcript: "",
    partialTranscript: "",
    segments: [],
    error: null,
    statusMessage: "Ready",
    model: null,
    sessionExpiresAt: null,
  };
}

export function applyRealtimeTranscriptEvent(
  state: RealtimeTranscriptState,
  event: RealtimeTranscriptEvent,
): RealtimeTranscriptState {
  if (event.kind === "delta") {
    const nextPartial = mergeText(state.partialTranscript, event.text);
    return {
      ...state,
      partialTranscript: nextPartial,
      segments: updatePartialSegments(state.segments, event, nextPartial),
      statusMessage: "Listening...",
    };
  }

  const completedText = event.text.trim();
  if (!completedText) {
    return {
      ...state,
      partialTranscript: "",
      segments: state.segments.filter((segment) => !segment.isPartial),
    };
  }

  const nextSegment: LiveTranscriptSegment = {
    start: typeof event.start === "number" ? event.start : state.segments.length * 4,
    end:
      typeof event.end === "number"
        ? event.end
        : (typeof event.start === "number" ? event.start : state.segments.length * 4) + 4,
    text: completedText,
    speaker: event.speaker,
    itemId: event.itemId,
    isPartial: false,
  };

  return {
    ...state,
    transcript: mergeText(state.transcript, completedText),
    partialTranscript: "",
    segments: [...state.segments.filter((segment) => !segment.isPartial), nextSegment],
    statusMessage: "Transcribing...",
  };
}

export function appendPartialSegment(
  state: RealtimeTranscriptState,
  text: string,
  itemId?: string,
): RealtimeTranscriptState {
  const partial = text.trim();
  if (!partial) return state;

  const partialSegment: LiveTranscriptSegment = {
    start: state.segments.length * 4,
    end: state.segments.length * 4 + 4,
    text: partial,
    itemId,
    isPartial: true,
  };

  return {
    ...state,
    partialTranscript: partial,
    segments: [...state.segments.filter((segment) => !segment.isPartial), partialSegment],
  };
}
