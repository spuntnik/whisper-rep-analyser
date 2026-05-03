import type {
  RealtimeSessionResponse,
  RealtimeTransportEvent,
} from "@/lib/realtime/types";

export interface RealtimeTransportCallbacks {
  onEvent: (event: RealtimeTransportEvent) => void;
}

export interface RealtimeTransportConnection {
  sendText: (text: string) => void;
  close: () => void;
}

export interface RealtimeTransportStartOptions {
  audioStream: MediaStream;
  session: RealtimeSessionResponse;
  model: string;
  callbacks: RealtimeTransportCallbacks;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

function parseEvent(data: unknown): RealtimeTransportEvent {
  if (typeof data !== "object" || data === null) {
    return {
      kind: "raw",
      event: { data },
    };
  }

  const event = data as Record<string, unknown>;
  const type = String(event.type ?? "");
  const delta = typeof event.delta === "string" ? event.delta : "";
  const transcript =
    typeof event.transcript === "string"
      ? event.transcript
      : typeof event.text === "string"
        ? event.text
        : "";
  const itemId = typeof event.item_id === "string" ? event.item_id : undefined;
  const speaker = typeof event.speaker === "string" ? event.speaker : undefined;
  const start = typeof event.start === "number" ? event.start : undefined;
  const end = typeof event.end === "number" ? event.end : undefined;

  if (type === "error") {
    const errorDetails = event.error;
    const errorMessage =
      typeof errorDetails === "object" &&
      errorDetails !== null &&
      "message" in errorDetails &&
      typeof (errorDetails as { message?: unknown }).message === "string"
        ? String((errorDetails as { message?: unknown }).message)
        : "Realtime error";

    return {
      kind: "error",
      message: errorMessage,
      details: event,
    };
  }

  if (
    type === "conversation.item.input_audio_transcription.delta" ||
    type === "response.audio_transcript.delta" ||
    type === "response.output_audio_transcript.delta" ||
    type === "response.text.delta"
  ) {
    return {
      kind: "delta",
      text: delta || transcript,
      itemId,
      speaker,
      start,
      end,
    };
  }

  if (
    type === "conversation.item.input_audio_transcription.completed" ||
    type === "response.audio_transcript.done" ||
    type === "response.output_audio_transcript.done" ||
    type === "response.text.done"
  ) {
    return {
      kind: "final",
      text: transcript || delta,
      itemId,
      speaker,
      start,
      end,
    };
  }

  if (type === "session.created" || type === "session.updated") {
    return {
      kind: "session",
      session: event as unknown as RealtimeSessionResponse,
    };
  }

  return {
    kind: "raw",
    event,
  };
}

export async function connectRealtimeTransport(
  options: RealtimeTransportStartOptions,
): Promise<RealtimeTransportConnection> {
  const { audioStream, session, model, callbacks } = options;
  const peerConnection = new RTCPeerConnection();
  const eventChannel = peerConnection.createDataChannel("oai-events");
  const tracks = audioStream.getTracks();

  tracks.forEach((track) => {
    peerConnection.addTrack(track, audioStream);
  });

  const ready = new Promise<void>((resolve, reject) => {
    eventChannel.onopen = () => {
      callbacks.onEvent({
        kind: "status",
        state: "connected",
        message: "Realtime session connected.",
      });
      resolve();
    };

    eventChannel.onclose = () => {
      callbacks.onEvent({
        kind: "status",
        state: "disconnected",
        message: "Realtime session disconnected.",
      });
    };

    eventChannel.onerror = () => {
      reject(new Error("Realtime data channel failed to open."));
    };

    eventChannel.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data as string);
        callbacks.onEvent(parseEvent(parsed));
      } catch {
        callbacks.onEvent({
          kind: "raw",
          event: { data: message.data },
        });
      }
    };
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const response = await fetch(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.client_secret.value}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp ?? "",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Unable to establish realtime connection.");
  }

  const answerSdp = await response.text();
  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: answerSdp,
  });

  await ready;

  return {
    sendText(text: string) {
      if (!eventChannel || eventChannel.readyState !== "open") return;
      eventChannel.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }],
          },
        }),
      );
      eventChannel.send(JSON.stringify({ type: "response.create" }));
    },
    close() {
      eventChannel.close();
      peerConnection.close();
      tracks.forEach((track) => track.stop());
    },
  };
}
