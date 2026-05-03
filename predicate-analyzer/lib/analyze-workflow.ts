import { analyzePredicateInput } from "@/lib/predicate-engine";
import { summarizeMeeting, type MeetingSummary } from "@/lib/meeting-summary";

export interface AnalysisWorkflowResult {
  transcript: string;
  meetingSummary: MeetingSummary;
  predicateAnalysis: ReturnType<typeof analyzePredicateInput>;
}

export function runAnalysisWorkflow(transcript: string): AnalysisWorkflowResult {
  return {
    transcript,
    meetingSummary: summarizeMeeting(transcript),
    predicateAnalysis: analyzePredicateInput(transcript),
  };
}
