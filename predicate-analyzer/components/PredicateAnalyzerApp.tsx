"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarkdownReport } from "@/lib/report";
import { runAnalysisWorkflow, type AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import type { TranscriptSegment, TranscriptionResult } from "@/lib/transcript";
import { formatTimestamp } from "@/lib/transcript";
import { PieChart } from "@/components/PieChart";

type CaptureMode = "typed" | "upload" | "record" | "live";

const LIVE_CHUNK_MS = 5000;

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function getMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

function toTitleCase(name: string) {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeSegments(existing: TranscriptSegment[], incoming: TranscriptSegment[]) {
  return [...existing, ...incoming].sort((left, right) => left.start - right.start);
}

export function PredicateAnalyzerApp() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>("typed");
  const [sourceLabel, setSourceLabel] = useState("Typed notes");
  const [textInput, setTextInput] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerDiarization, setSpeakerDiarization] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [workflow, setWorkflow] = useState<AnalysisWorkflowResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveQueueRef = useRef(Promise.resolve());
  const liveElapsedRef = useRef(0);
  const recordChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setCanRecord(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    if (!textInput.trim()) {
      setWorkflow(null);
      return;
    }

    setWorkflow(
      runAnalysisWorkflow({
        transcript: textInput.trim(),
        sourceLabel,
        segments,
      }),
    );
  }, [segments, sourceLabel, textInput]);

  useEffect(() => {
    return () => {
      void stopStream();
    };
  }, []);

  const chartData = useMemo(() => {
    if (!workflow) {
      return {
        labels: ["Visual", "Auditory", "Kinesthetic", "Auditory Digital"],
        values: [25, 25, 25, 25],
        colors: ["#535E8D", "#1F63AA", "#FF7F00", "#303F4B"],
      };
    }

    return {
      labels: workflow.predicateAnalysis.channels.map((channel) => channel.label),
      values: workflow.predicateAnalysis.channels.map((channel) => channel.percentage || 0),
      colors: workflow.predicateAnalysis.channels.map((channel) => channel.color),
    };
  }, [workflow]);

  const markdownReport = useMemo(() => {
    if (!workflow) return "";
    return buildMarkdownReport(workflow);
  }, [workflow]);

  const dominant = workflow?.predicateAnalysis.dominantChannel ?? null;
  const secondary = workflow?.predicateAnalysis.secondaryChannel ?? null;
  const keyPoints = workflow?.meetingSummary.keyPoints ?? [];
  const actionItems = workflow?.meetingSummary.actionItems ?? [];

  async function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function transcribeBlob(blob: Blob) {
    const file = blob instanceof File ? blob : new File([blob], "capture.webm", { type: blob.type });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("diarize", speakerDiarization ? "true" : "false");
    formData.append("responseFormat", "verbose_json");

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Transcription failed.");
    }

    return (await response.json()) as TranscriptionResult;
  }

  function absorbTranscription(result: TranscriptionResult, mode: CaptureMode, offset = 0) {
    const transcriptText = result.text.trim();
    const adjustedSegments = result.segments.map((segment) => ({
      ...segment,
      start: segment.start + offset,
      end: segment.end + offset,
    }));
    setErrorMessage(null);

    setTextInput((previous) => {
      if (!transcriptText) return previous;
      const next = mode === "live" ? [previous.trim(), transcriptText].filter(Boolean).join(" ") : transcriptText;
      return next.trim();
    });

    setSegments((previous) => {
      if (mode === "live") {
        return mergeSegments(previous, adjustedSegments);
      }
      return adjustedSegments;
    });

    setStatusMessage(
      transcriptText
        ? `Transcribed with ${result.model}${mode === "live" ? " in live mode" : ""}.`
        : "No speech detected.",
    );
    if (result.warning) {
      setErrorMessage(result.warning);
    }
  }

  async function handleFileUpload(file: File) {
    setCaptureMode("upload");
    setSourceLabel(toTitleCase(file.name));
    setErrorMessage(null);
    setIsBusy(true);
    setStatusMessage("Uploading audio for Whisper transcription...");

    try {
      const result = await transcribeBlob(file);
      absorbTranscription(result, "upload");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload transcription failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function startMicCapture(mode: Exclude<CaptureMode, "typed" | "upload">) {
    if (!canRecord) {
      setErrorMessage("This browser does not support microphone recording.");
      return;
    }

    setErrorMessage(null);
    setCaptureMode(mode);
    setSegments([]);
    setTextInput("");
    setStatusMessage(mode === "live" ? "Live transcription running..." : "Recording audio...");
    setSourceLabel(mode === "live" ? "Live meeting capture" : "Recorded meeting audio");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to access the microphone.");
      setStatusMessage("Microphone access denied.");
      return;
    }
    streamRef.current = stream;

    const mimeType = getMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recordChunksRef.current = [];

    if (mode === "live") {
      liveElapsedRef.current = 0;
      liveQueueRef.current = Promise.resolve();
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        const offset = liveElapsedRef.current;
        liveElapsedRef.current += LIVE_CHUNK_MS / 1000;

        liveQueueRef.current = liveQueueRef.current.then(async () => {
          try {
            const result = await transcribeBlob(event.data);
            absorbTranscription(result, "live", offset);
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Live transcription chunk failed.");
          }
        });
      };
      recorder.start(LIVE_CHUNK_MS);
    } else {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordChunksRef.current.push(event.data);
        }
      };
      recorder.start();
    }

    recorder.onstop = async () => {
      try {
        if (mode === "record") {
          const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          setIsBusy(true);
          setStatusMessage("Sending recording to Whisper...");
          const result = await transcribeBlob(blob);
          absorbTranscription(result, "record");
        }

        if (mode === "live") {
          setIsBusy(true);
          setStatusMessage("Finalizing live transcript...");
          await liveQueueRef.current;
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Recording transcription failed.");
      } finally {
        setIsBusy(false);
        setIsRecording(false);
        await stopStream();
      }
    };

    setIsRecording(true);
  }

  async function stopMicCapture() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.stop();
  }

  async function onToggleRecord(mode: Exclude<CaptureMode, "typed" | "upload">) {
    if (isRecording) {
      await stopMicCapture();
      return;
    }

    await startMicCapture(mode);
  }

  async function onDownloadMarkdown() {
    if (!markdownReport) return;
    const blob = new Blob([markdownReport], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meeting-report.md";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onPrintPdf() {
    window.print();
  }

  function onClearAll() {
    setCaptureMode("typed");
    setSourceLabel("Typed notes");
    setTextInput("");
    setSegments([]);
    setStatusMessage("Ready");
    setErrorMessage(null);
    setWorkflow(null);
  }

  const representativeStyle = workflow?.meetingSummary.speakerStyleSummary ?? "";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#535E8D] shadow-glow print:hidden lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5 p-6 sm:p-8 lg:p-10">
            <div className="inline-flex rounded-full border border-[#E6DBBD]/20 bg-[#303F4B]/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#E6DBBD]">
              Whisper + Rep Analyser
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-[#E6DBBD] sm:text-5xl">
                Meeting intelligence that transcribes, summarizes, and maps communication style.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-white/85 sm:text-lg">
                Upload audio, record a meeting, or switch to live capture. Whisper handles the
                transcript, then the report engine extracts notes, timestamps, key points, action
                items, and the internal representational system map.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Status", value: statusMessage },
                { label: "Mode", value: captureMode.toUpperCase() },
                { label: "Dominant", value: dominant?.label ?? "Pending" },
                { label: "Buying", value: workflow?.predicateAnalysis.buyingChannel ?? "Pending" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#303F4B]/35 p-4 text-[#E6DBBD]">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/55">
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm font-medium leading-6">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#303F4B] p-6 sm:p-8 lg:p-10">
            <div className="rounded-[1.75rem] border border-white/10 bg-[#E6DBBD] p-5 text-[#303F4B]">
              <div className="mb-3 flex items-center justify-between text-sm font-medium">
                <span>Channel split</span>
                <span>{workflow ? formatPercentage(workflow.predicateAnalysis.gap) : "0.0%"} gap</span>
              </div>
              <div className="h-[290px]">
                <PieChart
                  labels={chartData.labels}
                  values={chartData.values}
                  colors={chartData.colors}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FF7F00] p-4 text-[#303F4B]">
                <div className="text-[11px] uppercase tracking-[0.24em]">Confidence</div>
                <div className="mt-1 text-lg font-semibold">
                  {workflow?.predicateAnalysis.confidence ?? "Low"}
                </div>
              </div>
              <div className="rounded-2xl bg-[#1F63AA] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.24em]">Summary</div>
                <div className="mt-1 text-lg font-semibold">
                  {workflow ? "Ready" : "Pending"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] print:hidden">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-[#E6DBBD] p-6 text-[#303F4B] shadow-glow">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Input</h2>
              <p className="text-sm leading-6 text-[#303F4B]/75">
                Paste notes, upload audio, or capture a live meeting. Whisper transcription is the
                source of truth; the rep map and summary are built from the same transcript.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "typed", label: "Typed Notes" },
                { key: "upload", label: "Upload Audio" },
                { key: "record", label: "Record Meeting" },
                { key: "live", label: "Live Mode" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCaptureMode(item.key as CaptureMode)}
                  disabled={isRecording || isBusy}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    captureMode === item.key
                      ? "bg-[#535E8D] text-[#E6DBBD]"
                      : "border border-[#303F4B]/15 bg-white/50 text-[#303F4B] hover:bg-white/70"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {captureMode === "upload" ? (
              <label className="block rounded-3xl border border-dashed border-[#303F4B]/25 bg-white/45 p-5">
                <div className="text-sm font-semibold">Upload meeting audio</div>
                <div className="mt-1 text-sm text-[#303F4B]/70">
                  MP3, M4A, WAV, and similar browser-supported formats work best.
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  className="mt-4 block w-full text-sm text-[#303F4B]"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
              </label>
            ) : null}

            {captureMode === "typed" ? (
              <label className="block space-y-3">
                <span className="text-sm font-medium">Transcript / notes</span>
                <textarea
                  value={textInput}
                  onChange={(event) => {
                    setTextInput(event.target.value);
                    setSourceLabel("Typed notes");
                    setSegments([]);
                  }}
                  placeholder="Paste a meeting transcript or notes here..."
                  className="min-h-56 w-full rounded-3xl border border-[#303F4B]/15 bg-white/55 p-4 text-base leading-7 text-[#303F4B] outline-none placeholder:text-[#303F4B]/45 focus:border-[#1F63AA]"
                />
              </label>
            ) : null}

            {captureMode === "record" || captureMode === "live" ? (
              <div className="space-y-3 rounded-3xl border border-[#303F4B]/15 bg-white/40 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void onToggleRecord(captureMode)}
                    disabled={!canRecord || isBusy}
                    className="rounded-full bg-[#FF7F00] px-5 py-3 text-sm font-semibold text-[#303F4B] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRecording ? "Stop" : captureMode === "live" ? "Start Live Mode" : "Start Recording"}
                  </button>
                  <label className="flex items-center gap-2 rounded-full border border-[#303F4B]/15 bg-white/60 px-4 py-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={speakerDiarization}
                      onChange={(event) => setSpeakerDiarization(event.target.checked)}
                    />
                    Speaker diarization
                  </label>
                </div>
                <p className="text-sm leading-6 text-[#303F4B]/75">
                  {captureMode === "live"
                    ? "Live mode transcribes chunks as you speak. It feels live, but chunk boundaries and network latency can produce partial phrases."
                    : "Recording mode waits until you stop, then sends the full audio file to Whisper for a cleaner transcription."}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onDownloadMarkdown}
                disabled={!markdownReport}
                className="rounded-full bg-[#1F63AA] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Markdown
              </button>
              <button
                type="button"
                onClick={onPrintPdf}
                disabled={!workflow}
                className="rounded-full border border-[#303F4B]/20 bg-white/65 px-5 py-3 text-sm font-semibold text-[#303F4B] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="rounded-full border border-[#303F4B]/20 bg-white/55 px-5 py-3 text-sm font-semibold text-[#303F4B] transition hover:bg-white/80"
              >
                Clear
              </button>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-[#FF7F00]/40 bg-[#FF7F00]/10 px-4 py-3 text-sm text-[#303F4B]">
                {errorMessage}
              </div>
            ) : null}

            <div className="rounded-3xl border border-[#303F4B]/15 bg-white/50 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#303F4B]/55">
                Cleaned transcript
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#303F4B]">
                {workflow?.transcript || "Waiting for input..."}
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-[#303F4B] p-6 shadow-glow">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-[#E6DBBD]">Meeting Report</h2>
              <p className="text-sm leading-6 text-white/75">
                A presentation-style report with timeline, summary, and representational analysis.
              </p>
            </div>

            {workflow ? (
              <div className="space-y-5 rounded-[1.75rem] bg-[#E6DBBD] p-5 text-[#303F4B] print:bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Report</div>
                    <h3 className="mt-2 text-2xl font-semibold">{workflow.meetingSummary.title}</h3>
                    <div className="mt-1 text-sm text-[#303F4B]/70">{sourceLabel}</div>
                  </div>
                  <div className="rounded-2xl bg-[#535E8D] px-4 py-3 text-[#E6DBBD]">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                      Dominant channel
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {dominant ? dominant.label : "None"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Summary</div>
                    <div className="mt-2 text-sm leading-6">{workflow.meetingSummary.overview}</div>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#1F63AA]">
                      Speaker Style
                    </div>
                    <div className="mt-2 text-sm leading-6">{representativeStyle}</div>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#FF7F00]">
                      Buying Channel
                    </div>
                    <div className="mt-2 text-sm leading-6">
                      {workflow.predicateAnalysis.buyingChannel}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Key Points</div>
                    <div className="mt-3 space-y-2">
                      {keyPoints.length > 0 ? (
                        keyPoints.map((point) => (
                          <div key={`${point.start}-${point.text}`} className="rounded-xl bg-white px-3 py-2 text-sm leading-6">
                            <span className="mr-2 rounded-full bg-[#535E8D] px-2 py-1 text-[11px] text-white">
                              {formatTimestamp(point.start)}
                            </span>
                            {point.text}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[#303F4B]/70">No key points detected yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/70 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#FF7F00]">
                      Action Items
                    </div>
                    <div className="mt-3 space-y-2">
                      {actionItems.length > 0 ? (
                        actionItems.map((item) => (
                          <div key={`${item.start}-${item.text}`} className="rounded-xl bg-white px-3 py-2 text-sm leading-6">
                            <span className="mr-2 rounded-full bg-[#FF7F00] px-2 py-1 text-[11px] text-[#303F4B]">
                              {formatTimestamp(item.start)}
                            </span>
                            {item.text}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[#303F4B]/70">No explicit action items detected yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#1F63AA]">Timeline</div>
                  <div className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
                    {workflow.segments.length > 0 ? (
                      workflow.segments.map((segment) => (
                        <div key={`${segment.start}-${segment.text}`} className="rounded-xl border border-[#303F4B]/10 bg-white px-3 py-2 text-sm leading-6">
                          <span className="mr-2 rounded-full bg-[#1F63AA] px-2 py-1 text-[11px] text-white">
                            {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                          </span>
                          {segment.speaker ? <strong>{segment.speaker}: </strong> : null}
                          {segment.text}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[#303F4B]/70">
                        Timestamped audio will appear here after Whisper transcription.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {workflow.predicateAnalysis.channels.map((channel) => (
                    <div key={channel.key} className="rounded-2xl bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{channel.label}</span>
                        <span className="text-sm">{channel.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-[#303F4B]/10">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${channel.percentage}%`, backgroundColor: channel.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#535E8D] p-4 text-[#E6DBBD]">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                      Secondary Channel
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {secondary ? secondary.label : "None"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#1F63AA] p-4 text-white">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                      Confidence
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {workflow.predicateAnalysis.confidence}
                      {workflow.predicateAnalysis.gap > 0
                        ? ` (${formatPercentage(workflow.predicateAnalysis.gap)} gap)`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-white/10 bg-[#E6DBBD] p-5 text-[#303F4B]">
                Start typing, recording, or uploading audio to generate the meeting report.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6 text-white shadow-glow print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#E6DBBD]">Export-ready summary</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Markdown export gives you a clean handoff. Print / Save PDF uses the same report
                layout and works best after the transcription pass finishes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full bg-[#FF7F00] px-4 py-2 text-sm font-semibold text-[#303F4B]">
                Source: {sourceLabel}
              </div>
              <div className="rounded-full bg-[#E6DBBD] px-4 py-2 text-sm font-semibold text-[#303F4B]">
                {workflow ? "Report ready" : "Waiting for transcript"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
