import { NextRequest, NextResponse } from "next/server";
import {
  buildRealtimeSessionPayload,
  getRealtimeConnectionEndpoint,
  getRealtimeSessionCreationEndpoint,
  normalizeRealtimeModel,
} from "@/lib/realtime/models";

export const runtime = "nodejs";

type RealtimeSessionRequestBody = {
  model?: string;
  instructions?: string;
};

function buildPayload(body: RealtimeSessionRequestBody) {
  return buildRealtimeSessionPayload({
    model: normalizeRealtimeModel(body.model),
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
  const model = normalizeRealtimeModel(body.model);
  const creationEndpoint = getRealtimeSessionCreationEndpoint(model);
  const connectionEndpoint = getRealtimeConnectionEndpoint(model);
  const requestBody = JSON.stringify({
    expires_after: {
      anchor: "created_at",
      seconds: 600,
    },
    session: payload.session ?? payload,
  });
  const response = await fetch(creationEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: requestBody,
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
    const sessionObject =
      typeof session.session === "object" && session.session !== null
        ? (session.session as Record<string, unknown>)
        : session;
    return NextResponse.json({
      ...sessionObject,
      ...session,
      creation_endpoint: creationEndpoint,
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
