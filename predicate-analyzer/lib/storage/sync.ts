export type StorageSyncEventType =
  | "meeting.created"
  | "meeting.updated"
  | "segment.created"
  | "segment.updated"
  | "analysis.created"
  | "action-item.created"
  | "action-item.updated";

export interface StorageSyncEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: StorageSyncEventType;
  provider: "firebase" | "supabase";
  ownerId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface StorageSyncBatch {
  cursor?: string;
  events: StorageSyncEvent[];
}

export function buildSyncEvent<TPayload>(event: StorageSyncEvent<TPayload>): StorageSyncEvent<TPayload> {
  return event;
}
