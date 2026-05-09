export const DEFAULT_REALTIME_MODEL = "gpt-realtime";

export type RealtimeModel = "gpt-realtime" | "gpt-realtime-mini";

const SUPPORTED_REALTIME_MODELS = new Set<RealtimeModel>([
  "gpt-realtime",
  "gpt-realtime-mini",
]);

export function normalizeRealtimeModel(model?: string | null): RealtimeModel {
  if (!model) return DEFAULT_REALTIME_MODEL;
  return SUPPORTED_REALTIME_MODELS.has(model as RealtimeModel)
    ? (model as RealtimeModel)
    : DEFAULT_REALTIME_MODEL;
}
