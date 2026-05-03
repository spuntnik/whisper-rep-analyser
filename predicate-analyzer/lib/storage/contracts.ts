export type StorageProvider = "firebase" | "supabase";

export interface MeetingRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceLabel: string;
  captureMode: "typed" | "upload" | "record" | "live";
  transcript: string;
  overview: string;
  speakerStyleSummary: string;
  buyingChannel: string;
  confidence: string;
  gap: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegmentRecord {
  id: string;
  meetingId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  speaker?: string;
  isPartial: boolean;
  createdAt: string;
}

export interface ActionItemRecord {
  id: string;
  meetingId: string;
  startSeconds: number;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface AnalysisRecord {
  id: string;
  meetingId: string;
  dominantChannel: string;
  secondaryChannel: string;
  channelScores: Record<string, number>;
  phrases: string[];
  createdAt: string;
  updatedAt: string;
}
