export const REALTIME_MODEL_VALUES = [
  "gpt-realtime-2",
  "gpt-realtime",
  "gpt-realtime-mini",
  "gpt-realtime-translate",
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

const REALTIME_CALLS_ENDPOINT = "https://api.openai.com/v1/realtime/calls";

export type RealtimeSessionFamily = "realtime" | "translation";

export interface RealtimeModelBadge {
  label: string;
  tone: "blue" | "violet" | "orange" | "slate";
}

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

  return "realtime";
}

export function getRealtimeModelBadge(model?: string | null): RealtimeModelBadge {
  const normalized = normalizeRealtimeModel(model);

  if (normalized === "gpt-realtime-translate") {
    return {
      label: "Translation",
      tone: "violet",
    };
  }

  if (normalized === "gpt-realtime-mini") {
    return {
      label: "GA Realtime Mini",
      tone: "slate",
    };
  }

  if (normalized === "gpt-realtime-2") {
    return {
      label: "GA Realtime 2",
      tone: "violet",
    };
  }

  return {
    label: "GA Realtime",
    tone: "orange",
  };
}

export function getTranscriptionModelBadge(model?: string | null): RealtimeModelBadge {
  const normalized = normalizeTranscriptionModel(model);

  if (normalized === "gpt-4o-transcribe") {
    return {
      label: "Upload: GPT-4o Transcribe",
      tone: "violet",
    };
  }

  if (normalized === "whisper-1") {
    return {
      label: "Upload: Whisper",
      tone: "slate",
    };
  }

  return {
    label: "Upload: GPT-4o Mini Transcribe",
    tone: "blue",
  };
}

export function getRealtimeConnectionEndpoint(model: RealtimeModel) {
  return REALTIME_CALLS_ENDPOINT;
}

export function getRealtimeSessionCreationEndpoint(model: RealtimeModel) {
  void model;
  return REALTIME_CALLS_ENDPOINT;
}

export function buildRealtimeSessionPayload(input: {
  model?: string | null;
  instructions?: string;
}) {
  const model = normalizeRealtimeModel(input.model);

  return {
    session: {
      model,
      output_modalities: ["text" as const],
      instructions:
        input.instructions ??
        [
          model === "gpt-realtime-translate"
            ? "You are a live speech translation engine. Translate the speaker into clear English while preserving intent, names, and action items."
            : "You are a live meeting transcription engine. Transcribe the speaker accurately and emit concise final transcript segments.",
          "Do not answer questions unless explicitly asked to summarize.",
          "Preserve action-item and intent language for downstream meeting analysis.",
        ].join(" "),
    },
  };
}
