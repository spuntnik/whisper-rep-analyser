"use client";

import { useEffect, useRef, useState } from "react";
import { connectRealtimeTransport } from "@/lib/realtime/transport";
import { applyRealtimeTranscriptEvent, createInitialTranscriptState } from "@/lib/transcript-reducer";
import type {
  RealtimeSessionResponse,
  RealtimeTranscriptState,
  RealtimeTransportEvent,
} from "@/lib/realtime/types";

export interface UseRealtimeMeetingOptions {
  model?: string;
  language?: string;
}

function buildInstructions() {
  return [
    "You are a live meeting transcription engine.",
    "Transcribe the speaker accurately and emit concise final transcript segments.",
    "Do not answer questions unless explicitly asked to summarize.",
    "Keep speaker-style and sales-intent language for downstream analysis.",
  ].join(" ");
}

export function useRealtimeMeeting(options: UseRealtimeMeetingOptions = {}) {
  const model = options.model ?? "gpt-realtime-1.5";
  const [state, setState] = useState<RealtimeTranscriptState>(createInitialTranscriptState());
  const connectionRef = useRef<{ close: () => void; sendText: (text: string) => void } | null>(
    null,
  );
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof RTCPeerConnection !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  async function fetchSessionConfig(): Promise<RealtimeSessionResponse> {
    const response = await fetch("/api/realtime-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        language: options.language ?? "en",
        instructions: buildInstructions(),
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to create realtime session.");
    }

    return (await response.json()) as RealtimeSessionResponse;
  }

  function updateState(event: RealtimeTransportEvent) {
    if (event.kind === "status") {
      setState((previous) => ({
        ...previous,
        connectionState: event.state,
        statusMessage: event.message ?? previous.statusMessage,
      }));
      return;
    }

    if (event.kind === "error") {
      setState((previous) => ({
        ...previous,
        connectionState: "error",
        error: event.message,
        statusMessage: event.message,
      }));
      return;
    }

    if (event.kind === "session") {
      const expiresAt = event.session.client_secret.expires_at;
      const expiresIn =
        typeof expiresAt === "number"
          ? expiresAt
          : typeof expiresAt === "object" && expiresAt !== null
            ? expiresAt.seconds
            : undefined;

      setState((previous) => ({
        ...previous,
        model: event.session.model ?? previous.model,
        sessionExpiresAt:
          typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : previous.sessionExpiresAt,
      }));
      return;
    }

    if (event.kind === "delta") {
      setState((previous) => applyRealtimeTranscriptEvent(previous, event));
      return;
    }

    if (event.kind === "final") {
      setState((previous) => applyRealtimeTranscriptEvent(previous, event));
    }
  }

  async function start() {
    if (!supported || starting) return;

    setStarting(true);
    setState((previous) => ({
      ...previous,
      connectionState: "requesting-session",
      statusMessage: "Requesting realtime session...",
      error: null,
    }));

    try {
      const session = await fetchSessionConfig();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      setState((previous) => ({
        ...previous,
        connectionState: "connecting",
        statusMessage: "Connecting live transcription...",
        model: session.model,
      }));

      connectionRef.current = await connectRealtimeTransport({
        audioStream: stream,
        session,
        model: session.model,
        callbacks: {
          onEvent: updateState,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start realtime meeting.";
      setState((previous) => ({
        ...previous,
        connectionState: "error",
        error: message,
        statusMessage: message,
      }));
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    connectionRef.current?.close();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setState((previous) => ({
      ...previous,
      connectionState: previous.connectionState === "error" ? "error" : "disconnected",
      statusMessage: "Realtime session closed.",
    }));
  }

  function reset() {
    setState(createInitialTranscriptState());
  }

  return {
    supported,
    starting,
    state,
    start,
    stop,
    reset,
  };
}
