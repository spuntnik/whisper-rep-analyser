import { NextRequest, NextResponse } from "next/server";
import type { TranscriptSegment, TranscriptionResult } from "@/lib/transcript";
import {
  DEFAULT_TRANSCRIPTION_MODEL,
  normalizeTranscriptionModel,
} from "@/lib/realtime/models";

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

type SupportedTranscriptionResponseFormat = "json" | "text" | "verbose_json";

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

function chooseModel(requestedModel: string | null, useDiarization: boolean) {
  const normalized = normalizeTranscriptionModel(requestedModel);
  if (useDiarization) {
    return "gpt-4o-transcribe-diarize";
  }

  return normalized;
}

function chooseResponseFormat(
  model: string,
  requestedResponseFormat: string | null,
): SupportedTranscriptionResponseFormat {
  const normalized = String(requestedResponseFormat ?? "").toLowerCase();
  const wantsText = normalized === "text";
  const wantsVerbose = normalized === "verbose_json";

  if (model === "whisper-1") {
    if (wantsText) return "text";
    return "verbose_json";
  }

  if (model === "gpt-4o-transcribe-diarize") {
    if (wantsText) return "text";
    return "json";
  }

  if (wantsText) return "text";
  if (wantsVerbose) return "json";
  return "json";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const useDiarization = formData.get("diarize") === "true";
  const requestedModelValue = formData.get("model");
  const requestedModel = typeof requestedModelValue === "string" ? requestedModelValue : null;
  const model = chooseModel(requestedModel, useDiarization);
  const requestedResponseFormatValue = formData.get("responseFormat");
  const requestedResponseFormat =
    typeof requestedResponseFormatValue === "string" ? requestedResponseFormatValue : null;
  const responseFormat = chooseResponseFormat(model, requestedResponseFormat);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  const audioFile = file as File;

  async function submit(modelName: string, format: SupportedTranscriptionResponseFormat) {
    const attempt = new FormData();
    attempt.append("file", audioFile);
    attempt.append("model", modelName);
    attempt.append("response_format", format);
    if (format === "verbose_json" && modelName === "whisper-1") {
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
  let usedResponseFormat = responseFormat;
  let warning: string | undefined;
  let response = await submit(model, usedResponseFormat);
  if (!response.ok && useDiarization) {
    usedModel = DEFAULT_TRANSCRIPTION_MODEL;
    warning = "Speaker diarization fell back to GPT-4o mini Transcribe.";
    usedResponseFormat = chooseResponseFormat(DEFAULT_TRANSCRIPTION_MODEL, requestedResponseFormat);
    response = await submit(DEFAULT_TRANSCRIPTION_MODEL, usedResponseFormat);
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
