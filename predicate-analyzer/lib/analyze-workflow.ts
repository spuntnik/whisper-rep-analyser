import { analyzePredicateInput } from "@/lib/predicate-engine";
import { summarizeMeeting, type MeetingSummary } from "@/lib/meeting-summary";
import type { TranscriptSegment } from "@/lib/transcript";

export interface AnalysisWorkflowInput {
  transcript: string;
  sourceLabel?: string;
  segments?: TranscriptSegment[];
}

export interface AnalysisWorkflowResult {
  transcript: string;
  sourceLabel: string;
  segments: TranscriptSegment[];
  meetingSummary: MeetingSummary;
  predicateAnalysis: ReturnType<typeof analyzePredicateInput>;
}

export function runAnalysisWorkflow(input: AnalysisWorkflowInput): AnalysisWorkflowResult {
  const sourceLabel = input.sourceLabel ?? "Transcript";
  const segments = input.segments ?? [];
  const transcript = input.transcript;

  return {
    transcript,
    sourceLabel,
    segments,
    meetingSummary: summarizeMeeting(transcript, segments),
    predicateAnalysis: analyzePredicateInput(transcript),
  };
}
