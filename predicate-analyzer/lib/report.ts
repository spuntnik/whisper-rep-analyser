import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import { formatTimestamp } from "@/lib/transcript";

export function buildMarkdownReport(workflow: AnalysisWorkflowResult) {
  const { meetingSummary, predicateAnalysis, transcript, sourceLabel } = workflow;
  const segments = workflow.segments ?? [];

  const segmentLines = (segments.length > 0 ? segments : []).map((segment) => {
    const speaker = segment.speaker ? `${segment.speaker}: ` : "";
    return `- [${formatTimestamp(segment.start)}-${formatTimestamp(segment.end)}] ${speaker}${segment.text}`;
  });

  return [
    `# ${meetingSummary.title}`,
    ``,
    `**Source:** ${sourceLabel}`,
    ``,
    `## Summary`,
    meetingSummary.overview,
    ``,
    `## Speaker Style Summary`,
    meetingSummary.speakerStyleSummary,
    ``,
    `## Key Points`,
    ...meetingSummary.keyPoints.map((point) => `- [${formatTimestamp(point.start)}] ${point.text}`),
    ``,
    `## Action Items`,
    ...(meetingSummary.actionItems.length > 0
      ? meetingSummary.actionItems.map((item) => `- [${formatTimestamp(item.start)}] ${item.text}`)
      : [`- None detected`]),
    ``,
    `## Timeline`,
    ...(segmentLines.length > 0 ? segmentLines : [`- No timestamped transcript available yet.`]),
    ``,
    `## Representational Map`,
    ...predicateAnalysis.channels.map(
      (channel) => `- ${channel.label}: ${channel.percentage.toFixed(1)}%`,
    ),
    ``,
    `**Dominant:** ${predicateAnalysis.dominantChannel?.label ?? "None"}`,
    `**Secondary:** ${predicateAnalysis.secondaryChannel?.label ?? "None"}`,
    `**Buying Channel:** ${predicateAnalysis.buyingChannel}`,
    ``,
    `## Transcript`,
    transcript || "No transcript available.",
    ``,
  ].join("\n");
}

