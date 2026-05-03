import { NextRequest, NextResponse } from "next/server";
import { runAnalysisWorkflow } from "@/lib/analyze-workflow";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text ?? "";

  return NextResponse.json({
    ...runAnalysisWorkflow(text),
  });
}
