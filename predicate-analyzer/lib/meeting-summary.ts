import type { TranscriptSegment } from "@/lib/transcript";

export interface MeetingPoint {
  start: number;
  text: string;
}

export interface MeetingSummary {
  title: string;
  overview: string;
  keyPoints: MeetingPoint[];
  actionItems: MeetingPoint[];
  shortSummary: string;
  speakerStyleSummary: string;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "have",
  "with",
  "this",
  "from",
  "there",
  "their",
  "about",
  "would",
  "could",
  "should",
  "you",
  "your",
  "for",
  "are",
  "was",
  "were",
  "they",
  "them",
  "been",
  "will",
  "into",
  "what",
  "when",
  "then",
  "than",
  "just",
  "like",
  "more",
  "need",
  "today",
  "next",
  "meeting",
  "talk",
  "discuss",
]);

function normalizeText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2019']/g, "'")
    .trim();
}

function sentenceSplit(text: string) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function keywordFrequency(text: string) {
  const counts = new Map<string, number>();
  const tokens = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word) && word.length > 2);

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function sentenceScore(sentence: string, keywords: string[]) {
  const lower = sentence.toLowerCase();
  return keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

function isActionItem(sentence: string) {
  const lower = sentence.toLowerCase();
  return (
    lower.includes("we should") ||
    lower.includes("let's") ||
    lower.includes("next step") ||
    lower.includes("action item") ||
    lower.includes("follow up") ||
    lower.includes("need to") ||
    lower.includes("send")
  );
}

function toSentenceSegments(rawText: string): TranscriptSegment[] {
  const sentences = sentenceSplit(rawText);
  if (sentences.length === 0) return [];

  const duration = Math.max(4, Math.round(sentences.join(" ").split(/\s+/).filter(Boolean).length / 18));

  return sentences.map((sentence, index) => {
    const start = index * duration;
    return {
      start,
      end: start + duration,
      text: sentence,
    };
  });
}

export function summarizeMeeting(rawText: string, segments: TranscriptSegment[] = []): MeetingSummary {
  const cleaned = normalizeText(rawText);
  const sentences = sentenceSplit(cleaned);
  const keywords = keywordFrequency(cleaned).slice(0, 6).map(([word]) => word);
  const timeline = segments.length > 0 ? segments : toSentenceSegments(cleaned);

  const scored = timeline
    .map((segment, index) => ({
      segment,
      index,
      score: sentenceScore(segment.text, keywords),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const keyPoints = scored
    .filter((item) => item.score > 0)
    .slice(0, 4)
    .map((item) => ({ start: item.segment.start, text: item.segment.text }));

  const actionItems = timeline
    .filter((segment) => isActionItem(segment.text))
    .slice(0, 4)
    .map((segment) => ({ start: segment.start, text: segment.text }));

  const titleKeyword = keywords[0] ? keywords[0][0].toUpperCase() + keywords[0].slice(1) : "Meeting";

  const overview =
    sentences.length > 0
      ? `This meeting centers on ${keywords.slice(0, 3).join(", ") || "the main discussion topics"}.`
      : "No transcript yet. Add a recording or paste notes to generate a meeting summary.";

  const shortSummary =
    keyPoints[0]?.text ??
    sentences[0] ??
    "Transcript received, but not enough signal yet for a useful summary.";

  const dominantTheme = keywords.slice(0, 3).join(", ") || "the main discussion topics";
  const speakerStyleSummary = keyPoints[0]
    ? `The speaker leans toward ${dominantTheme}, with the strongest emphasis appearing around ${formatMinutes(keyPoints[0].start)}.`
    : `The speaker pattern is still emerging. Once more audio is captured, the app will describe the dominant style against ${dominantTheme}.`;

  return {
    title: `${titleKeyword} Meeting Notes`,
    overview,
    keyPoints: keyPoints.length > 0 ? keyPoints : timeline.slice(0, 3).map((segment) => ({ start: segment.start, text: segment.text })),
    actionItems,
    shortSummary,
    speakerStyleSummary,
  };
}

function formatMinutes(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
