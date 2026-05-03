"use client";

import { formatTimestamp } from "@/lib/transcript";
import type { RealtimeTranscriptState } from "@/lib/realtime/types";

export interface LiveTranscriptStreamProps {
  state: RealtimeTranscriptState;
}

function connectionTone(state: RealtimeTranscriptState["connectionState"]) {
  switch (state) {
    case "connected":
      return "bg-emerald-500";
    case "connecting":
    case "requesting-session":
      return "bg-[#FF7F00]";
    case "error":
      return "bg-rose-500";
    case "disconnected":
      return "bg-slate-500";
    default:
      return "bg-[#1F63AA]";
  }
}

export function LiveTranscriptStream({ state }: LiveTranscriptStreamProps) {
  const displayText = [state.transcript, state.partialTranscript].filter(Boolean).join(" ").trim();

  return (
    <section className="rounded-[1.75rem] border border-[#303F4B]/15 bg-white/55 p-4 text-[#303F4B]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Live stream</div>
          <div className="mt-1 text-sm font-semibold">{state.statusMessage}</div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#303F4B] px-3 py-2 text-xs font-semibold text-white">
          <span className={`h-2.5 w-2.5 rounded-full ${connectionTone(state.connectionState)}`} />
          {state.connectionState}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-[#303F4B]/10 bg-[#E6DBBD]/55 p-4">
        <div className="text-xs uppercase tracking-[0.24em] text-[#535E8D]">Transcript</div>
        <div className="mt-2 min-h-28 whitespace-pre-wrap text-sm leading-7">
          {displayText || "Live transcript will appear here once the session starts."}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[#303F4B] p-4 text-white">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Model</div>
          <div className="mt-1 text-sm font-semibold">{state.model ?? "Pending"}</div>
        </div>
        <div className="rounded-2xl bg-[#1F63AA] p-4 text-white">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Session</div>
          <div className="mt-1 text-sm font-semibold">
            {state.sessionExpiresAt
              ? new Date(state.sessionExpiresAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Active"}
          </div>
        </div>
      </div>

      {state.segments.length > 0 ? (
        <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
          {state.segments.map((segment, index) => (
            <div
              key={`${segment.itemId ?? index}-${segment.start}-${segment.text}`}
              className={`rounded-2xl px-3 py-2 text-sm leading-6 ${
                segment.isPartial
                  ? "border border-[#FF7F00]/25 bg-[#FF7F00]/15"
                  : "border border-[#303F4B]/10 bg-white"
              }`}
            >
              <span className="mr-2 rounded-full bg-[#535E8D] px-2 py-1 text-[11px] text-white">
                {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
              </span>
              {segment.speaker ? <strong>{segment.speaker}: </strong> : null}
              {segment.text}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
