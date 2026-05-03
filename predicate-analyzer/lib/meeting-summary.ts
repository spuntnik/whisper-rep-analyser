export interface MeetingSummary {
  title: string;
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  shortSummary: string;
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

function buildActionItems(sentences: string[]) {
  return sentences.filter((sentence) => {
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
  });
}

export function summarizeMeeting(rawText: string): MeetingSummary {
  const cleaned = normalizeText(rawText);
  const sentences = sentenceSplit(cleaned);
  const keywords = keywordFrequency(cleaned).slice(0, 6).map(([word]) => word);

  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: sentenceScore(sentence, keywords),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const keyPoints = [...new Set(scored.filter((item) => item.score > 0).slice(0, 4).map((item) => item.sentence))];
  const actionItems = [...new Set(buildActionItems(sentences))].slice(0, 4);

  const titleKeyword = keywords[0] ? keywords[0][0].toUpperCase() + keywords[0].slice(1) : "Meeting";

  const overview =
    sentences.length > 0
      ? `This meeting centers on ${keywords.slice(0, 3).join(", ") || "the main discussion topics"}.`
      : "No transcript yet. Add a recording or paste notes to generate a meeting summary.";

  const shortSummary =
    keyPoints[0] ??
    sentences[0] ??
    "Transcript received, but not enough signal yet for a useful summary.";

  return {
    title: `${titleKeyword} Meeting Notes`,
    overview,
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : sentences.slice(0, 3),
    actionItems,
    shortSummary,
  };
}
