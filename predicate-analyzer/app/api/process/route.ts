import { NextRequest, NextResponse } from "next/server";
import { runAnalysisWorkflow } from "@/lib/analyze-workflow";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    transcript?: string;
    sourceLabel?: string;
  };
  const transcript = body.transcript ?? "";

  return NextResponse.json(
    runAnalysisWorkflow({ transcript, sourceLabel: body.sourceLabel ?? "Transcript" }),
  );
}
