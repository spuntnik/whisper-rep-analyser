export const REALTIME_MODEL_VALUES = [
  "gpt-realtime-2",
  "gpt-realtime",
  "gpt-realtime-mini",
  "gpt-realtime-translate",
  "gpt-realtime-whisper",
] as const;

export const TRANSCRIPTION_MODEL_VALUES = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-4o-transcribe-diarize",
  "whisper-1",
] as const;

export type RealtimeModel = (typeof REALTIME_MODEL_VALUES)[number];
export type TranscriptionModel = (typeof TRANSCRIPTION_MODEL_VALUES)[number];

export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime";
export const DEFAULT_TRANSCRIPTION_MODEL: TranscriptionModel = "gpt-4o-mini-transcribe";

export const REALTIME_MODEL_OPTIONS = [
  {
    value: "gpt-realtime-2",
    label: "GPT Realtime 2",
    description: "Best for more capable realtime voice interactions.",
  },
  {
    value: "gpt-realtime",
    label: "GPT Realtime",
    description: "General-availability realtime model for live meetings.",
  },
  {
    value: "gpt-realtime-mini",
    label: "GPT Realtime Mini",
    description: "Lower-cost realtime model for live capture.",
  },
  {
    value: "gpt-realtime-translate",
    label: "GPT Realtime Translate",
    description: "Streaming speech-to-speech translation for live calls.",
  },
  {
    value: "gpt-realtime-whisper",
    label: "GPT Realtime Whisper",
    description: "Low-latency live transcription with transcript deltas.",
  },
] as const satisfies ReadonlyArray<{
  value: RealtimeModel;
  label: string;
  description: string;
}>;

export const TRANSCRIPTION_MODEL_OPTIONS = [
  {
    value: "gpt-4o-mini-transcribe",
    label: "GPT-4o mini Transcribe",
    description: "Fast, accurate transcription for recorded audio.",
  },
  {
    value: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    description: "Higher-quality transcription for demanding audio.",
  },
  {
    value: "whisper-1",
    label: "Whisper",
    description: "General-purpose speech recognition fallback.",
  },
] as const satisfies ReadonlyArray<{
  value: TranscriptionModel;
  label: string;
  description: string;
}>;

const REALTIME_SESSION_ENDPOINT = "https://api.openai.com/v1/realtime";
const REALTIME_TRANSLATION_ENDPOINT = "https://api.openai.com/v1/realtime/translations";
const REALTIME_TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/realtime/transcription_sessions";

export type RealtimeSessionFamily = "realtime" | "translation" | "transcription";

export function normalizeRealtimeModel(model?: string | null): RealtimeModel {
  if (model && (REALTIME_MODEL_VALUES as readonly string[]).includes(model)) {
    return model as RealtimeModel;
  }

  return DEFAULT_REALTIME_MODEL;
}

export function normalizeTranscriptionModel(model?: string | null): TranscriptionModel {
  if (model && (TRANSCRIPTION_MODEL_VALUES as readonly string[]).includes(model)) {
    return model as TranscriptionModel;
  }

  return DEFAULT_TRANSCRIPTION_MODEL;
}

export function getRealtimeSessionFamily(model: RealtimeModel): RealtimeSessionFamily {
  if (model === "gpt-realtime-translate") {
    return "translation";
  }

  if (model === "gpt-realtime-whisper") {
    return "transcription";
  }

  return "realtime";
}

export function getRealtimeConnectionEndpoint(model: RealtimeModel) {
  switch (getRealtimeSessionFamily(model)) {
    case "translation":
      return REALTIME_TRANSLATION_ENDPOINT;
    case "transcription":
      return REALTIME_TRANSCRIPTION_ENDPOINT;
    case "realtime":
    default:
      return REALTIME_SESSION_ENDPOINT;
  }
}

export function buildRealtimeSessionPayload(input: {
  model?: string | null;
  language?: string;
  instructions?: string;
}) {
  const model = normalizeRealtimeModel(input.model);
  const family = getRealtimeSessionFamily(model);

  if (family === "translation") {
    return {
      model,
      instructions:
        input.instructions ??
        [
          "You are a live speech translation engine.",
          "Translate the speaker into clear English while preserving intent, names, and action items.",
          "Emit concise transcript updates so downstream meeting analysis can summarize the call.",
        ].join(" "),
    };
  }

  if (family === "transcription") {
    return {
      model,
      instructions:
        input.instructions ??
        [
          "You are a live transcription engine.",
          "Transcribe the speaker accurately and emit concise transcript updates.",
          "Preserve action-item language and speaker boundaries for downstream analysis.",
        ].join(" "),
      language: input.language ?? "en",
    };
  }

  return {
    model,
    modalities: ["text"],
    input_audio_transcription: {
      model: "gpt-4o-mini-transcribe",
      language: input.language ?? "en",
    },
    turn_detection: {
      type: "server_vad",
      prefix_padding_ms: 300,
      silence_duration_ms: 700,
      threshold: 0.55,
    },
    instructions:
      input.instructions ??
      [
        "You are a live meeting transcription engine.",
        "Transcribe the speaker accurately and emit concise transcript updates.",
        "Do not answer questions unless explicitly asked to summarize.",
        "Preserve action-item and intent language for downstream meeting analysis.",
      ].join(" "),
  };
}
