"use client";

import { useEffect, useMemo, useState } from "react";
import { runAnalysisWorkflow, type AnalysisWorkflowResult } from "@/lib/analyze-workflow";
import { PieChart } from "@/components/PieChart";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
      Enter text or record a voice note to generate meeting notes, key points, and the internal
      representational map.
    </div>
  );
}

export function PredicateAnalyzerApp() {
  const [inputText, setInputText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [workflow, setWorkflow] = useState<AnalysisWorkflowResult | null>(null);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    const sourceText = inputText.trim() || transcript.trim();
    if (!sourceText) {
      setWorkflow(null);
      return;
    }
    setWorkflow(runAnalysisWorkflow(sourceText));
  }, [inputText, transcript]);

  const chartData = useMemo(() => {
    if (!workflow) {
      return {
        labels: ["Visual", "Auditory", "Kinesthetic", "Auditory Digital"],
        values: [25, 25, 25, 25],
        colors: ["#c9937d", "#1a7a8a", "#34d399", "#a78bfa"],
      };
    }

    return {
      labels: workflow.predicateAnalysis.channels.map((channel) => channel.label),
      values: workflow.predicateAnalysis.channels.map((channel) => channel.percentage || 0),
      colors: workflow.predicateAnalysis.channels.map((channel) => channel.color),
    };
  }, [workflow]);

  const activeSource = inputText.trim() || transcript.trim();
  const dominant = workflow?.predicateAnalysis.dominantChannel ?? null;
  const secondary = workflow?.predicateAnalysis.secondaryChannel ?? null;

  const startVoiceCapture = async () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError("Browser speech recognition is not available in this browser.");
      return;
    }

    setVoiceError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const fullTranscript = results.map((result) => result[0]?.transcript ?? "").join(" ");
      const cleanedTranscript = fullTranscript.replace(/\s+/g, " ").trim();
      setTranscript(cleanedTranscript);
      setInputText(cleanedTranscript);
    };

    recognition.onerror = (event) => {
      setVoiceError(event.error || "Speech capture failed.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  };

  const copySuggestions = workflow?.predicateAnalysis.phraseSuggestions ?? [];
  const meetingSummary = workflow?.meetingSummary ?? null;

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-glow backdrop-blur">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.9fr] lg:p-10">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Communication Intelligence Engine
              </div>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Meeting intelligence for notes, transcription, and representational analysis.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Record a meeting, capture the transcript, summarize the discussion, and map the
                  speaker's representational channel in one flow.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Mode", value: workflow ? "Live analysis" : "Ready" },
                  {
                    label: "Dominant",
                    value: dominant?.label ?? "None",
                  },
                  {
                    label: "Summary",
                    value: meetingSummary ? "Generated" : "Pending",
                  },
                  {
                    label: "Confidence",
                    value: workflow?.predicateAnalysis.confidence ?? "Low",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-slate-950/25 p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-2 text-lg font-medium text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/30 p-5">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                <span>Channel split</span>
                <span>{workflow ? formatPercentage(workflow.predicateAnalysis.gap) : "0.0%"} gap</span>
              </div>
              <div className="h-[340px]">
                <PieChart
                  labels={chartData.labels}
                  values={chartData.values}
                  colors={chartData.colors}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Record or paste transcript</h2>
              <p className="text-sm text-slate-300">
                Use browser speech recognition for voice capture, or paste a transcript and let the
                app generate meeting notes and the rep map together.
              </p>
            </div>

            <label className="block space-y-3">
              <span className="text-sm font-medium text-slate-200">Transcript / notes</span>
              <textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="Try: We should align on next steps, the client needs reassurance, and I can explain the logic."
                className="min-h-44 w-full rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-base leading-7 text-white outline-none transition placeholder:text-slate-500 focus:border-primary/60"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startVoiceCapture}
                disabled={!voiceSupported || isListening}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isListening ? "Listening..." : "Voice Input"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("");
                  setTranscript("");
                  setVoiceError(null);
                  setWorkflow(null);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Clear
              </button>
              <div className="flex items-center rounded-full border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
                {voiceSupported ? "Browser STT available" : "Browser STT unavailable"}
              </div>
            </div>

            {voiceError ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {voiceError}
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Cleaned transcript
              </h3>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-200">
                {workflow?.predicateAnalysis.cleanedText || activeSource || "Waiting for input..."}
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Meeting Notes</h2>
              <p className="text-sm text-slate-300">
                Summary, key points, and action items extracted from the transcript.
              </p>
            </div>

            {meetingSummary ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Title
                  </div>
                  <div className="mt-2 text-lg font-semibold">{meetingSummary.title}</div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Overview
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{meetingSummary.overview}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Key Points
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                      {meetingSummary.keyPoints.map((point) => (
                        <li key={point} className="rounded-2xl bg-white/5 px-3 py-2">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Action Items
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                      {(meetingSummary.actionItems.length > 0
                        ? meetingSummary.actionItems
                        : ["No explicit action items detected yet."]
                      ).map((item) => (
                        <li key={item} className="rounded-2xl bg-white/5 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-200">
                  {meetingSummary.shortSummary}
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Representational Map</h2>
              <p className="text-sm text-slate-300">
                Visual, Auditory, Kinesthetic, and Auditory Digital scoring from the transcript.
              </p>
            </div>

            {workflow ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {workflow.predicateAnalysis.channels.map((channel) => (
                    <div
                      key={channel.key}
                      className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-100">{channel.label}</span>
                        <span className="text-sm text-slate-300">{channel.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${channel.percentage}%`,
                            backgroundColor: channel.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Dominant Channel
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {dominant ? dominant.label : "None"}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Secondary Channel
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {secondary ? secondary.label : "None"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Buying Channel
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {workflow.predicateAnalysis.buyingChannel}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      Confidence
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {workflow.predicateAnalysis.confidence}{" "}
                      {workflow.predicateAnalysis.gap > 0
                        ? `(${formatPercentage(workflow.predicateAnalysis.gap)} gap)`
                        : ""}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Suggested Phrases
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {copySuggestions.map((phrase) => (
                      <span
                        key={phrase}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                  Source text is currently scoring{" "}
                  {workflow.predicateAnalysis.totalScore} points across the four channels.
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Combined Output</h2>
              <p className="text-sm text-slate-300">
                This is the merged view: meeting notes on one side and the rep analyzer on the
                other.
              </p>
            </div>

            {workflow ? (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-7 text-slate-200">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Transcript
                  </div>
                  <p className="mt-2">{workflow.transcript}</p>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Sales Angle
                  </div>
                  <p className="mt-2">
                    {workflow.predicateAnalysis.dominantChannel
                      ? `Lead with ${workflow.predicateAnalysis.dominantChannel.buyingChannel.toLowerCase()} messaging.`
                      : "No dominant buying pattern yet."}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
