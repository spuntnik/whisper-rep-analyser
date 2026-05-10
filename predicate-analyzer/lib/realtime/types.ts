export type RealtimeConnectionState =
  | "idle"
  | "requesting-session"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface RealtimeSessionConfig {
  model: string;
  clientSecret: string;
  expiresAt?: number;
}

export interface RealtimeSessionResponse {
  model: string;
  type?: "realtime" | "transcription";
  connection_endpoint?: string;
  creation_endpoint?: string;
  instructions?: string;
  client_secret: {
    value: string;
    expires_at?:
      | number
      | {
          anchor: "created_at";
          seconds: number;
      };
  };
  audio?: {
    input?: {
      format?: {
        type?: "audio/pcm";
        rate?: number;
      };
      transcription?: {
        model?: "gpt-4o-transcribe" | "gpt-4o-mini-transcribe" | "whisper-1" | "gpt-realtime-whisper";
        language?: string;
        prompt?: string;
      };
      turn_detection?: {
        type?: "server_vad" | "semantic_vad";
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
        threshold?: number;
        eagerness?: "low" | "medium" | "high" | "auto";
        create_response?: boolean;
        interrupt_response?: boolean;
      };
      noise_reduction?: {
        type?: "near_field" | "far_field";
      } | null;
    };
  };
  input_audio_format?: "pcm16" | "g711_ulaw" | "g711_alaw";
  input_audio_transcription?: {
    language?: string;
    model?: "gpt-4o-transcribe" | "gpt-4o-mini-transcribe" | "whisper-1";
    prompt?: string;
  };
  transcription?: {
    language?: string;
    model?:
      | "gpt-4o-transcribe"
      | "gpt-4o-mini-transcribe"
      | "gpt-4o-transcribe-diarize"
      | "whisper-1"
      | "gpt-realtime-whisper";
    prompt?: string;
  };
  modalities?: Array<"text" | "audio">;
  output_modalities?: Array<"text" | "audio">;
  turn_detection?: {
    type: "server_vad" | "semantic_vad";
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
    threshold?: number;
    eagerness?: "low" | "medium" | "high" | "auto";
    create_response?: boolean;
    interrupt_response?: boolean;
  };
  include?: string[];
}

export type RealtimeTranscriptKind = "delta" | "final";

export interface RealtimeTranscriptEvent {
  kind: RealtimeTranscriptKind;
  text: string;
  itemId?: string;
  speaker?: string;
  start?: number;
  end?: number;
}

export interface RealtimeStatusEvent {
  kind: "status";
  state: RealtimeConnectionState;
  message?: string;
}

export interface RealtimeErrorEvent {
  kind: "error";
  message: string;
  details?: unknown;
}

export type RealtimeTransportEvent =
  | RealtimeTranscriptEvent
  | RealtimeStatusEvent
  | RealtimeErrorEvent
  | {
      kind: "session";
      session: RealtimeSessionResponse;
    }
  | {
      kind: "raw";
      event: Record<string, unknown>;
    };

export interface LiveTranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  itemId?: string;
  isPartial?: boolean;
}

export interface RealtimeTranscriptState {
  connectionState: RealtimeConnectionState;
  transcript: string;
  partialTranscript: string;
  segments: LiveTranscriptSegment[];
  error: string | null;
  statusMessage: string;
  model: string | null;
  sessionExpiresAt: number | null;
}
