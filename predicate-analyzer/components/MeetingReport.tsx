"use client";

import dynamic from "next/dynamic";
import { formatTimestamp } from "@/lib/transcript";
import type { AnalysisWorkflowResult } from "@/lib/analyze-workflow";

const LazyPieChart = dynamic(
  () => import("@/components/PieChart").then((module) => module.PieChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#303F4B]/20 bg-white/55 text-sm text-[#303F4B]/65">
        Loading chart...
      </div>
    ),
  },
);

export interface MeetingReportProps {
  workflow: AnalysisWorkflowResult | null;
  sourceLabel: string;
  statusMessage: string;
  saveStatus?: string | null;
  onDownloadMarkdown: () => void;
  onPrintPdf: () => void;
  onSaveToFirebase?: () => void;
  onClearAll: () => void;
}

function reportMetricColor(index: number) {
  return ["#535E8D", "#1F63AA", "#FF7F00", "#303F4B"][index % 4];
}

export function MeetingReport({
  workflow,
  sourceLabel,
  statusMessage,
  saveStatus,
  onDownloadMarkdown,
  onPrintPdf,
  onSaveToFirebase,
  onClearAll,
}: MeetingReportProps) {
  return (
    <>
      <section className="space-y-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[#303F4B] p-6 shadow-glow print:hidden">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[#E6DBBD]">Meeting Report</h2>
          <p className="text-sm leading-6 text-white/75">
            A presentation-style report with timeline, summary, action items, and representational analysis.
          </p>
        </div>

        {workflow ? (
        <div className="space-y-5 overflow-hidden rounded-[1.75rem] bg-[#E6DBBD] p-5 text-[#303F4B] print:bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Report</div>
              <h3 className="mt-2 text-2xl font-semibold">{workflow.meetingSummary.title}</h3>
              <div className="mt-1 text-sm text-[#303F4B]/70">{sourceLabel}</div>
              <div className="mt-2 text-sm text-[#303F4B]/70">{statusMessage}</div>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl bg-[#535E8D] px-4 py-3 text-[#E6DBBD]">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                Dominant channel
              </div>
              <div className="mt-1 text-lg font-semibold">
                {workflow.predicateAnalysis.dominantChannel?.label ?? "None"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="overflow-hidden rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Summary</div>
              <div className="mt-2 text-sm leading-6">{workflow.meetingSummary.overview}</div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#1F63AA]">Speaker Style</div>
              <div className="mt-2 text-sm leading-6">
                {workflow.meetingSummary.speakerStyleSummary}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#FF7F00]">Buying Channel</div>
              <div className="mt-2 text-sm leading-6">{workflow.predicateAnalysis.buyingChannel}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Key Points</div>
              <div className="mt-3 space-y-2">
                {workflow.meetingSummary.keyPoints.length > 0 ? (
                  workflow.meetingSummary.keyPoints.map((point) => (
                    <div
                      key={`${point.start}-${point.text}`}
                      className="rounded-xl bg-white px-3 py-2 text-sm leading-6 break-words"
                    >
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

            <div className="overflow-hidden rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#FF7F00]">Action Items</div>
              <div className="mt-3 space-y-2">
                {workflow.meetingSummary.actionItems.length > 0 ? (
                  workflow.meetingSummary.actionItems.map((item) => (
                    <div
                      key={`${item.start}-${item.text}`}
                      className="rounded-xl bg-white px-3 py-2 text-sm leading-6 break-words"
                    >
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

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="overflow-hidden rounded-2xl bg-white/70 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-[#1F63AA]">Timeline</div>
              <div className="mt-3 max-h-[320px] space-y-2 overflow-auto pr-1">
                {workflow.segments.length > 0 ? (
                  workflow.segments.map((segment) => (
                    <div
                      key={`${segment.start}-${segment.text}`}
                      className="rounded-xl border border-[#303F4B]/10 bg-white px-3 py-2 text-sm leading-6 break-words"
                    >
                      <span className="mr-2 rounded-full bg-[#1F63AA] px-2 py-1 text-[11px] text-white">
                        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                      </span>
                      {segment.speaker ? <strong>{segment.speaker}: </strong> : null}
                      {segment.text}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[#303F4B]/70">
                    Timestamped audio will appear here after transcription.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/50 p-4">
                <div className="mb-3 flex items-center justify-between text-sm font-medium">
                  <span>Channel split</span>
                  <span>{workflow.predicateAnalysis.gap.toFixed(1)}% gap</span>
                </div>
                <div className="h-[290px] overflow-hidden">
                  <LazyPieChart
                    labels={workflow.predicateAnalysis.channels.map((channel) => channel.label)}
                    values={workflow.predicateAnalysis.channels.map((channel) => channel.percentage)}
                    colors={workflow.predicateAnalysis.channels.map((channel) => channel.color)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-2xl bg-[#535E8D] p-4 text-[#E6DBBD]">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                    Secondary Channel
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {workflow.predicateAnalysis.secondaryChannel?.label ?? "None"}
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl bg-[#1F63AA] p-4 text-white">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                    Confidence
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {workflow.predicateAnalysis.confidence}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {workflow.predicateAnalysis.channels.map((channel, index) => (
                  <div
                    key={channel.key}
                    className="min-w-0 overflow-hidden rounded-2xl bg-white/70 p-4"
                    style={{ borderTop: `4px solid ${reportMetricColor(index)}` }}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 break-normal whitespace-normal text-sm font-semibold leading-5">
                        {channel.label}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {channel.percentage.toFixed(1)}%
                      </span>
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
            </div>
          </div>

          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={onDownloadMarkdown}
              className="rounded-full bg-[#1F63AA] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Export Markdown
            </button>
            <button
              type="button"
              onClick={onPrintPdf}
              className="rounded-full border border-[#303F4B]/20 bg-white/65 px-5 py-3 text-sm font-semibold text-[#303F4B] transition hover:bg-white/80"
            >
              Print / Save PDF
            </button>
            {onSaveToFirebase ? (
              <button
                type="button"
                onClick={onSaveToFirebase}
                className="rounded-full bg-[#535E8D] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                Save to Firebase
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-full border border-[#303F4B]/20 bg-white/55 px-5 py-3 text-sm font-semibold text-[#303F4B] transition hover:bg-white/80"
            >
              Clear
            </button>
          </div>
          {saveStatus ? <div className="text-sm text-[#303F4B]/70">{saveStatus}</div> : null}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-white/10 bg-[#E6DBBD] p-5 text-[#303F4B]">
          Start typing, recording, or uploading audio to generate the meeting report.
        </div>
      )}
      </section>
    </>
  );
}
