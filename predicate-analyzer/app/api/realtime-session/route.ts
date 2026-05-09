import { NextRequest, NextResponse } from "next/server";
import {
  buildRealtimeSessionPayload,
  getRealtimeConnectionEndpoint,
  normalizeRealtimeModel,
} from "@/lib/realtime/models";

export const runtime = "nodejs";

const REALTIME_SESSION_ENDPOINT = "https://api.openai.com/v1/realtime/sessions";

type RealtimeSessionRequestBody = {
  model?: string;
  instructions?: string;
  language?: string;
};

function buildPayload(body: RealtimeSessionRequestBody) {
  return buildRealtimeSessionPayload({
    model: normalizeRealtimeModel(body.model),
    language: body.language,
    instructions: body.instructions,
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as RealtimeSessionRequestBody;
  const payload = buildPayload(body);
  const connectionEndpoint = getRealtimeConnectionEndpoint(
    normalizeRealtimeModel(body.model),
  );
  const response = await fetch(REALTIME_SESSION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Unable to create realtime session.",
        details: text,
      },
      { status: response.status },
    );
  }

  try {
    const session = JSON.parse(text) as Record<string, unknown>;
    return NextResponse.json({
      ...session,
      connection_endpoint: connectionEndpoint,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Realtime session returned invalid JSON.",
        details: text,
      },
      { status: 502 },
    );
  }
}
