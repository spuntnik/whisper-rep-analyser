import { FieldValue, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";

export interface SaveMeetingInput {
  workflow: AnalysisWorkflowResult;
  sourceLabel: string;
  captureMode: AnalysisWorkflowResult["captureMode"];
  ownerId?: string;
}

export async function saveMeetingToFirebase(input: SaveMeetingInput) {
  const db = getFirebaseAdminFirestore();
  const ownerId = input.ownerId ?? "anonymous";
  const meetingRef = db.collection("meetings").doc();

  const meetingData = {
    ownerId,
    title: input.workflow.meetingSummary.title,
    sourceLabel: input.sourceLabel,
    captureMode: input.captureMode,
    transcript: input.workflow.transcript,
    overview: input.workflow.meetingSummary.overview,
    speakerStyleSummary: input.workflow.meetingSummary.speakerStyleSummary,
    buyingChannel: input.workflow.predicateAnalysis.buyingChannel,
    confidence: input.workflow.predicateAnalysis.confidence,
    gap: input.workflow.predicateAnalysis.gap,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await meetingRef.set(meetingData);

  const segmentWrites = input.workflow.segments.map((segment) =>
    meetingRef.collection("segments").add({
      startSeconds: segment.start,
      endSeconds: segment.end,
      text: segment.text,
      speaker: segment.speaker ?? null,
      isPartial: Boolean((segment as { isPartial?: boolean }).isPartial),
      createdAt: FieldValue.serverTimestamp(),
    }),
  );

  const actionItemWrites = input.workflow.meetingSummary.actionItems.map((actionItem) =>
    meetingRef.collection("actionItems").add({
      startSeconds: actionItem.start,
      text: actionItem.text,
      completed: false,
      createdAt: FieldValue.serverTimestamp(),
    }),
  );

  const analysisDoc = meetingRef.collection("analysis").doc("latest");
  await analysisDoc.set({
    dominantChannel: input.workflow.predicateAnalysis.dominantChannel?.label ?? "",
    secondaryChannel: input.workflow.predicateAnalysis.secondaryChannel?.label ?? "",
    channelScores: Object.fromEntries(
      input.workflow.predicateAnalysis.channels.map((channel) => [channel.key, channel.score]),
    ),
    phrases: input.workflow.predicateAnalysis.phraseSuggestions,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await Promise.all([...segmentWrites, ...actionItemWrites]);

  return {
    id: meetingRef.id,
    ownerId,
  };
}
