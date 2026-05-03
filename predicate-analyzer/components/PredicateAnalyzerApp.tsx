"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarkdownReport } from "@/lib/report";
import { runAnalysisWorkflow, type AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import type { TranscriptSegment, TranscriptionResult } from "@/lib/transcript";
import { useRealtimeMeeting } from "@/hooks/use-realtime-meeting";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { LiveTranscriptStream } from "@/components/LiveTranscriptStream";
import { MeetingReport } from "@/components/MeetingReport";
import { PieChart } from "@/components/PieChart";

type CaptureMode = "typed" | "upload" | "record" | "live";

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
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [canRecord, setCanRecord] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const realtime = useRealtimeMeeting({ model: "gpt-realtime-1.5" });
  const firebaseReady = useMemo(() => Boolean(getFirebaseClientServices()), []);

  useEffect(() => {
    setCanRecord(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      void stopAllCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveTranscript = [realtime.state.transcript, realtime.state.partialTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();

  const workflow = useMemo<AnalysisWorkflowResult | null>(() => {
    if (captureMode === "live") {
      if (!liveTranscript) return null;

      return runAnalysisWorkflow({
        transcript: liveTranscript,
        sourceLabel: "Live meeting capture",
        segments: realtime.state.segments
          .filter((segment) => !segment.isPartial)
          .map((segment) => ({
            start: segment.start,
            end: segment.end,
            text: segment.text,
            speaker: segment.speaker,
          })),
        captureMode: "live",
      });
    }

    if (!textInput.trim()) return null;

    return runAnalysisWorkflow({
      transcript: textInput.trim(),
      sourceLabel,
      segments,
      captureMode,
    });
  }, [captureMode, liveTranscript, realtime.state.segments, segments, sourceLabel, textInput]);

  const markdownReport = useMemo(() => {
    if (!workflow) return "";
    return buildMarkdownReport(workflow);
  }, [workflow]);

  const displayStatusMessage =
    captureMode === "live" && statusMessage !== "Ready"
      ? statusMessage
      : captureMode === "live"
        ? realtime.state.statusMessage
        : statusMessage;
  const liveReady = realtime.supported && !realtime.starting;
  const recordReady = canRecord && !isBusy;

  async function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function stopAllCapture() {
    await stopStream();
    await realtime.stop();
    setIsRecording(false);
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
    if (mode === "live" && !realtime.supported) {
      setErrorMessage("This browser does not support realtime live mode.");
      return;
    }

    if (mode === "record" && !canRecord) {
      setErrorMessage("This browser does not support microphone recording.");
      return;
    }

    setErrorMessage(null);
    setCaptureMode(mode);
    setSegments([]);
    setTextInput("");
    setSourceLabel(mode === "live" ? "Live meeting capture" : "Recorded meeting audio");

    if (mode === "live") {
      realtime.reset();
      setStatusMessage("Preparing realtime live mode...");
      try {
        await realtime.start();
        setIsRecording(true);
        setStatusMessage("Realtime live transcription running...");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to start realtime live mode.");
      }
      return;
    }

    setStatusMessage("Recording audio...");

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

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      try {
        setIsBusy(true);
        setStatusMessage("Sending recording to Whisper...");
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const result = await transcribeBlob(blob);
        absorbTranscription(result, "record");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Recording transcription failed.");
      } finally {
        setIsBusy(false);
        setIsRecording(false);
        await stopStream();
      }
    };

    recorder.start();
    setIsRecording(true);
  }

  async function stopMicCapture() {
    if (captureMode === "live") {
      await realtime.stop();
      setIsRecording(false);
      return;
    }

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

  async function saveCurrentWorkflow() {
    if (!workflow) {
      setSaveStatus("Nothing to save yet.");
      return;
    }

    setSaveStatus("Saving to Firebase...");

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow,
          sourceLabel,
          captureMode,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "Unable to save meeting to Firebase.");
      }

      const data = (await response.json()) as { id?: string };
      setSaveStatus(data.id ? `Saved to Firebase as ${data.id}.` : "Saved to Firebase.");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Unable to save meeting to Firebase.");
    }
  }

  async function onClearAll() {
    await stopAllCapture();
    realtime.reset();
    setCaptureMode("typed");
    setSourceLabel("Typed notes");
    setTextInput("");
    setSegments([]);
    setStatusMessage("Ready");
    setErrorMessage(null);
    setSaveStatus(null);
  }

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
                { label: "Status", value: displayStatusMessage },
                { label: "Mode", value: captureMode.toUpperCase() },
                {
                  label: "Dominant",
                  value: workflow?.predicateAnalysis.dominantChannel?.label ?? "Pending",
                },
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
                <span>{workflow ? `${workflow.predicateAnalysis.gap.toFixed(1)}%` : "0.0%"} gap</span>
              </div>
              <div className="h-[290px]">
                <div className="h-full">
                  {/* The pie chart remains visible even before transcription starts. */}
                  {workflow ? (
                    <MeetingChart workflow={workflow} />
                  ) : (
                    <MeetingChart workflow={null} />
                  )}
                </div>
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
                    disabled={
                      (captureMode === "record" && !recordReady) ||
                      (captureMode === "live" && !liveReady)
                    }
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
                    ? "Live mode uses a realtime audio stream and a browser WebRTC connection. It is lower-latency than chunked uploads, but depends on browser support and a stable network."
                    : "Recording mode waits until you stop, then sends the full audio file to Whisper for a cleaner transcription."}
                </p>
                {captureMode === "live" ? <LiveTranscriptStream state={realtime.state} /> : null}
              </div>
            ) : null}

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

          <MeetingReport
            workflow={workflow}
            sourceLabel={sourceLabel}
            statusMessage={displayStatusMessage}
            saveStatus={saveStatus}
            onDownloadMarkdown={onDownloadMarkdown}
            onPrintPdf={onPrintPdf}
            onSaveToFirebase={workflow ? () => void saveCurrentWorkflow() : undefined}
            onClearAll={onClearAll}
          />
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
              <div className="rounded-full bg-[#1F63AA] px-4 py-2 text-sm font-semibold text-white">
                {firebaseReady ? "Firebase ready" : "Firebase pending"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MeetingChart({ workflow }: { workflow: AnalysisWorkflowResult | null }) {
  const labels = workflow
    ? workflow.predicateAnalysis.channels.map((channel) => channel.label)
    : ["Visual", "Auditory", "Kinesthetic", "Auditory Digital"];
  const values = workflow
    ? workflow.predicateAnalysis.channels.map((channel) => channel.percentage || 0)
    : [25, 25, 25, 25];
  const colors = workflow
    ? workflow.predicateAnalysis.channels.map((channel) => channel.color)
    : ["#535E8D", "#1F63AA", "#FF7F00", "#303F4B"];

  return <PieChart labels={labels} values={values} colors={colors} />;
}
