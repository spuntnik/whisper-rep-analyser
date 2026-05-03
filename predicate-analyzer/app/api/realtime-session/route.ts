import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const REALTIME_SESSION_ENDPOINT = "https://api.openai.com/v1/realtime/sessions";

type RealtimeSessionRequestBody = {
  model?: string;
  instructions?: string;
  language?: string;
};

function buildPayload(body: RealtimeSessionRequestBody) {
  return {
    model: body.model ?? "gpt-realtime-1.5",
    modalities: ["text"],
    input_audio_transcription: {
      model: "gpt-4o-mini-transcribe",
      language: body.language ?? "en",
    },
    turn_detection: {
      type: "server_vad",
      prefix_padding_ms: 300,
      silence_duration_ms: 700,
      threshold: 0.55,
    },
    instructions:
      body.instructions ??
      [
        "You are a live meeting transcription engine.",
        "Transcribe the speaker accurately and emit concise transcript updates.",
        "Do not answer questions unless explicitly asked to summarize.",
        "Preserve action-item and intent language for downstream meeting analysis.",
      ].join(" "),
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as RealtimeSessionRequestBody;
  const response = await fetch(REALTIME_SESSION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPayload(body)),
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
    return NextResponse.json(JSON.parse(text));
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
