export type ChannelKey = "visual" | "auditory" | "kinesthetic" | "auditoryDigital";

export type ConfidenceLevel = "High" | "Moderate" | "Low";

export interface ChannelConfig {
  key: ChannelKey;
  label: string;
  color: string;
  buyingChannel: string;
  phrases: string[];
  strongWords: string[];
  words: string[];
}

export interface ChannelScore {
  key: ChannelKey;
  label: string;
  color: string;
  buyingChannel: string;
  score: number;
  percentage: number;
}

export interface PredicateAnalysis {
  rawText: string;
  cleanedText: string;
  totalScore: number;
  gap: number;
  confidence: ConfidenceLevel;
  dominantChannel: ChannelScore | null;
  secondaryChannel: ChannelScore | null;
  channels: ChannelScore[];
  phraseSuggestions: string[];
  buyingChannel: string;
}

const CHANNELS: ChannelConfig[] = [
  {
    key: "visual",
    label: "Visual",
    color: "#c9937d",
    buyingChannel: "Visual Trust",
    phrases: [
      "let me show you",
      "can we look at this clearly",
      "i can picture",
      "see what i mean",
      "make this clear",
    ],
    strongWords: ["show", "look", "clear", "picture", "visualize", "see"],
    words: ["image", "bright", "focus", "view", "display", "highlight"],
  },
  {
    key: "auditory",
    label: "Auditory",
    color: "#1a7a8a",
    buyingChannel: "Auditory Reassurance",
    phrases: [
      "let's talk through it",
      "does this sound right",
      "hear me out",
      "let's discuss this",
      "talk it through",
    ],
    strongWords: ["hear", "talk", "sound", "listen", "discuss", "speak"],
    words: ["conversation", "voice", "call", "say", "mention", "resonate"],
  },
  {
    key: "kinesthetic",
    label: "Kinesthetic",
    color: "#34d399",
    buyingChannel: "Kinesthetic Experience",
    phrases: [
      "let's make this practical",
      "this should feel easier",
      "get a feel for it",
      "let's put it into action",
    ],
    strongWords: ["feel", "practical", "action", "try", "move", "experience"],
    words: ["hands", "touch", "step", "apply", "build", "comfortable", "easy"],
  },
  {
    key: "auditoryDigital",
    label: "Auditory Digital",
    color: "#a78bfa",
    buyingChannel: "Logical Justification",
    phrases: [
      "let me explain",
      "this makes sense because",
      "the logic is",
      "here's why this matters",
    ],
    strongWords: ["think", "logic", "explain", "reason", "understand", "analyze"],
    words: ["because", "data", "evidence", "justify", "clarify", "compare", "decide"],
  },
];

const CHANNEL_ORDER: ChannelKey[] = ["visual", "auditory", "kinesthetic", "auditoryDigital"];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  if (!text) return [];
  return text.split(" ").filter(Boolean);
}

function countWord(tokens: string[], word: string) {
  return tokens.reduce((count, token) => (token === word ? count + 1 : count), 0);
}

function countPhrase(tokens: string[], phrase: string) {
  const phraseTokens = tokenize(normalizeText(phrase));
  if (!phraseTokens.length || phraseTokens.length > tokens.length) return 0;

  let matches = 0;
  for (let index = 0; index <= tokens.length - phraseTokens.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (tokens[index + offset] !== phraseTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) matches += 1;
  }
  return matches;
}

function scoreChannel(config: ChannelConfig, tokens: string[]) {
  let score = 0;

  for (const phrase of config.phrases) {
    score += countPhrase(tokens, phrase) * 3;
  }

  for (const word of config.strongWords) {
    score += countWord(tokens, word) * 2;
  }

  for (const word of config.words) {
    score += countWord(tokens, word) * 1;
  }

  return score;
}

function confidenceFromGap(gap: number): ConfidenceLevel {
  if (gap >= 15) return "High";
  if (gap >= 8) return "Moderate";
  return "Low";
}

const PHRASE_SUGGESTIONS: Record<ChannelKey, string[]> = {
  visual: ["Let me show you", "Can we look at this clearly?"],
  auditory: ["Let's talk through it", "Does this sound right?"],
  kinesthetic: ["Let's make this practical", "This should feel easier."],
  auditoryDigital: ["Let me explain", "This makes sense because..."],
};

export function analyzePredicateInput(rawText: string): PredicateAnalysis {
  const cleanedText = normalizeText(rawText);
  const tokens = tokenize(cleanedText);
  const totalScore = CHANNELS.reduce((sum, config) => sum + scoreChannel(config, tokens), 0);

  const channels = CHANNELS.map((config) => {
    const score = scoreChannel(config, tokens);
    return {
      key: config.key,
      label: config.label,
      color: config.color,
      buyingChannel: config.buyingChannel,
      score,
      percentage: totalScore > 0 ? Number(((score / totalScore) * 100).toFixed(1)) : 0,
    };
  });

  const sorted = [...channels].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return CHANNEL_ORDER.indexOf(left.key) - CHANNEL_ORDER.indexOf(right.key);
  });

  const dominantChannel = sorted[0] && sorted[0].score > 0 ? sorted[0] : null;
  const secondaryChannel = sorted[1] && sorted[1].score > 0 ? sorted[1] : null;
  const gap =
    dominantChannel && secondaryChannel
      ? Number((dominantChannel.percentage - secondaryChannel.percentage).toFixed(1))
      : dominantChannel
        ? Number(dominantChannel.percentage.toFixed(1))
        : 0;

  const confidence = confidenceFromGap(gap);
  const buyingChannel = dominantChannel?.buyingChannel ?? "Unclear";
  const phraseSuggestions = dominantChannel
    ? [
        ...PHRASE_SUGGESTIONS[dominantChannel.key],
        ...(secondaryChannel ? [PHRASE_SUGGESTIONS[secondaryChannel.key][0]] : []),
      ]
    : Object.values(PHRASE_SUGGESTIONS)
        .flat()
        .slice(0, 3);

  return {
    rawText,
    cleanedText,
    totalScore,
    gap,
    confidence,
    dominantChannel,
    secondaryChannel,
    channels,
    phraseSuggestions,
    buyingChannel,
  };
}
