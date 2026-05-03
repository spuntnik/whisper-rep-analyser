import { NextRequest, NextResponse } from "next/server";
import type { TranscriptSegment, TranscriptionResult } from "@/lib/transcript";

export const runtime = "nodejs";

const TRANSCRIPTION_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

type OpenAiTranscriptionSegment = {
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
};

type OpenAiTranscriptionPayload = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: OpenAiTranscriptionSegment[];
  model?: string;
};

function normalizeSegments(segments: OpenAiTranscriptionSegment[] | undefined) {
  return (segments ?? [])
    .map<TranscriptSegment>((segment) => ({
      start: Number(segment.start ?? 0),
      end: Number(segment.end ?? segment.start ?? 0),
      text: String(segment.text ?? "").trim(),
      speaker: segment.speaker ? String(segment.speaker) : undefined,
    }))
    .filter((segment) => segment.text.length > 0);
}

function chooseModel(useDiarization: boolean) {
  return useDiarization ? "gpt-4o-transcribe-diarize" : "whisper-1";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const useDiarization = formData.get("diarize") === "true";
  const model = chooseModel(useDiarization);
  const responseFormat = formData.get("responseFormat") === "text" ? "text" : "verbose_json";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  async function submit(modelName: string) {
    const attempt = new FormData();
    attempt.append("file", file);
    attempt.append("model", modelName);
    attempt.append("response_format", responseFormat);
    if (responseFormat === "verbose_json") {
      attempt.append("timestamp_granularities[]", "segment");
    }

    return fetch(TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: attempt,
    });
  }

  let usedModel = model;
  let warning: string | undefined;
  let response = await submit(model);
  if (!response.ok && useDiarization) {
    usedModel = "whisper-1";
    warning = "Speaker diarization fell back to whisper-1.";
    response = await submit("whisper-1");
  }

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: "Transcription failed.",
        details: errorText,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as OpenAiTranscriptionPayload;
  const segments = normalizeSegments(data.segments);
  const transcript = String(data.text ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const result: TranscriptionResult = {
    text: transcript,
    segments:
      segments.length > 0
        ? segments
        : transcript
            .split(/\.\s+|\n+/)
            .map((text, index) => ({
              start: index * 5,
              end: index * 5 + 5,
              text: text.trim(),
            }))
            .filter((segment) => segment.text.length > 0),
    model: data.model ?? usedModel,
    language: data.language,
    duration: data.duration,
    warning,
  };

  return NextResponse.json(result);
}
