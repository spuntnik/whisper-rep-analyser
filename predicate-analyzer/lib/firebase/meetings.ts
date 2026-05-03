import { FieldValue, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import type { TranscriptSegment } from "@/lib/transcript";

export interface SaveMeetingInput {
  workflow: AnalysisWorkflowResult;
  sourceLabel: string;
  captureMode: AnalysisWorkflowResult["captureMode"];
  ownerId?: string;
}

export interface FirebaseMeetingSummary {
  id: string;
  ownerId: string;
  title: string;
  sourceLabel: string;
  captureMode: AnalysisWorkflowResult["captureMode"];
  buyingChannel: string;
  confidence: string;
  gap: number;
  createdAt: string;
  updatedAt: string;
}

export interface FirebaseMeetingDetail {
  meeting: FirebaseMeetingSummary;
  transcript: string;
  segments: TranscriptSegment[];
}

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return new Date(0).toISOString();
}

function toMeetingSummary(id: string, data: Record<string, unknown>): FirebaseMeetingSummary {
  return {
    id,
    ownerId: String(data.ownerId ?? "anonymous"),
    title: String(data.title ?? "Meeting"),
    sourceLabel: String(data.sourceLabel ?? "Transcript"),
    captureMode: (data.captureMode as AnalysisWorkflowResult["captureMode"]) ?? "typed",
    buyingChannel: String(data.buyingChannel ?? "Unclear"),
    confidence: String(data.confidence ?? "Low"),
    gap: Number(data.gap ?? 0),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
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

export async function listMeetingsFromFirebase(ownerId: string, limit = 12) {
  const db = getFirebaseAdminFirestore();
  const snapshot = await db.collection("meetings").where("ownerId", "==", ownerId).get();

  return snapshot.docs
    .map((doc) => toMeetingSummary(doc.id, doc.data() as Record<string, unknown>))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function loadMeetingFromFirebase(meetingId: string, ownerId: string) {
  const db = getFirebaseAdminFirestore();
  const meetingRef = db.collection("meetings").doc(meetingId);
  const meetingSnapshot = await meetingRef.get();

  if (!meetingSnapshot.exists) {
    throw new Error("Meeting not found.");
  }

  const meetingData = meetingSnapshot.data() as Record<string, unknown>;
  if (String(meetingData.ownerId ?? "anonymous") !== ownerId) {
    throw new Error("You do not have access to this meeting.");
  }

  const segmentSnapshots = await meetingRef.collection("segments").get();
  const segments = segmentSnapshots.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .map(
      (segment) =>
        ({
          start: Number(segment.startSeconds ?? 0),
          end: Number(segment.endSeconds ?? 0),
          text: String(segment.text ?? ""),
          speaker: segment.speaker ? String(segment.speaker) : undefined,
        }) as TranscriptSegment,
    )
    .sort((left, right) => left.start - right.start);

  return {
    meeting: toMeetingSummary(meetingSnapshot.id, meetingData),
    transcript: String(meetingData.transcript ?? ""),
    segments,
  };
}

export async function deleteMeetingFromFirebase(meetingId: string, ownerId: string) {
  const db = getFirebaseAdminFirestore();
  const meetingRef = db.collection("meetings").doc(meetingId);
  const meetingSnapshot = await meetingRef.get();

  if (!meetingSnapshot.exists) {
    throw new Error("Meeting not found.");
  }

  const meetingData = meetingSnapshot.data() as Record<string, unknown>;
  if (String(meetingData.ownerId ?? "anonymous") !== ownerId) {
    throw new Error("You do not have access to this meeting.");
  }

  const collectionNames = ["segments", "actionItems", "analysis"];
  await Promise.all(
    collectionNames.map(async (collectionName) => {
      const snapshot = await meetingRef.collection(collectionName).get();
      await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    }),
  );

  await meetingRef.delete();

  return {
    id: meetingSnapshot.id,
    ownerId,
  };
}
