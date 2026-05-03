import { analyzePredicateInput } from "@/lib/predicate-engine";
import { summarizeMeeting, type MeetingSummary } from "@/lib/meeting-summary";
import type { TranscriptSegment } from "@/lib/transcript";

export interface AnalysisWorkflowInput {
  transcript: string;
  sourceLabel?: string;
  segments?: TranscriptSegment[];
  captureMode?: "typed" | "upload" | "record" | "live";
}

export interface AnalysisWorkflowResult {
  transcript: string;
  sourceLabel: string;
  segments: TranscriptSegment[];
  captureMode: "typed" | "upload" | "record" | "live";
  meetingSummary: MeetingSummary;
  predicateAnalysis: ReturnType<typeof analyzePredicateInput>;
}

export function runAnalysisWorkflow(input: AnalysisWorkflowInput): AnalysisWorkflowResult {
  const sourceLabel = input.sourceLabel ?? "Transcript";
  const segments = input.segments ?? [];
  const transcript = input.transcript;
  const captureMode = input.captureMode ?? "typed";

  return {
    transcript,
    sourceLabel,
    segments,
    captureMode,
    meetingSummary: summarizeMeeting(transcript, segments),
    predicateAnalysis: analyzePredicateInput(transcript),
  };
}
