import { NextRequest, NextResponse } from "next/server";
import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import { saveMeetingToFirebase } from "@/lib/firebase/meetings";

export const runtime = "nodejs";

type SaveMeetingBody = {
  workflow?: AnalysisWorkflowResult;
  sourceLabel?: string;
  captureMode?: AnalysisWorkflowResult["captureMode"];
  ownerId?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SaveMeetingBody;

  if (!body.workflow) {
    return NextResponse.json({ error: "Missing workflow payload." }, { status: 400 });
  }

  try {
    const result = await saveMeetingToFirebase({
      workflow: body.workflow,
      sourceLabel: body.sourceLabel ?? body.workflow.sourceLabel,
      captureMode: body.captureMode ?? body.workflow.captureMode,
      ownerId: body.ownerId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save meeting.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
