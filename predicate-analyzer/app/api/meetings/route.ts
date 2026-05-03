import { NextRequest, NextResponse } from "next/server";
import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import {
  deleteMeetingFromFirebase,
  listMeetingsFromFirebase,
  loadMeetingFromFirebase,
  saveMeetingToFirebase,
} from "@/lib/firebase/meetings";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type SaveMeetingBody = {
  workflow?: AnalysisWorkflowResult;
  sourceLabel?: string;
  captureMode?: AnalysisWorkflowResult["captureMode"];
  ownerId?: string;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

async function getOwnerId(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Missing Firebase auth token.");
  }

  const decoded = await verifyFirebaseIdToken(token);
  return decoded.uid;
}

export async function GET(request: NextRequest) {
  try {
    const ownerId = await getOwnerId(request);
    const url = new URL(request.url);
    const meetingId = url.searchParams.get("id");

    if (meetingId) {
      const meeting = await loadMeetingFromFirebase(meetingId, ownerId);
      return NextResponse.json({
        ok: true,
        ...meeting,
      });
    }

    const meetings = await listMeetingsFromFirebase(ownerId);
    return NextResponse.json({
      ok: true,
      meetings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load meetings.";
    const status = message.includes("auth")
      ? 401
      : message.includes("access")
        ? 403
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SaveMeetingBody;

  if (!body.workflow) {
    return NextResponse.json({ error: "Missing workflow payload." }, { status: 400 });
  }

  try {
    const ownerId = await getOwnerId(request);
    const result = await saveMeetingToFirebase({
      workflow: body.workflow,
      sourceLabel: body.sourceLabel ?? body.workflow.sourceLabel,
      captureMode: body.captureMode ?? body.workflow.captureMode,
      ownerId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save meeting.";
    const status = message.includes("auth")
      ? 401
      : message.includes("access")
        ? 403
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ownerId = await getOwnerId(request);
    const url = new URL(request.url);
    const meetingId = url.searchParams.get("id");

    if (!meetingId) {
      return NextResponse.json({ error: "Missing meeting id." }, { status: 400 });
    }

    const result = await deleteMeetingFromFirebase(meetingId, ownerId);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete meeting.";
    const status = message.includes("auth")
      ? 401
      : message.includes("access")
        ? 403
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
