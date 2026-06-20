export type TransitAssistantIntent =
  | "eta"
  | "delay"
  | "weather"
  | "traffic"
  | "crowding"
  | "navigation"
  | "help"
  | "out-of-scope";

export interface TransitAssistantIntentResult {
  intent: TransitAssistantIntent;
  confidence: number;
  reason?: string;
}

export interface TransitAssistantIntentContext {
  stopId?: string;
  routeId?: number;
  direction?: string;
  destinationId?: string;
  lastIntent?: TransitAssistantIntent;
}

const VALID_INTENTS = new Set<TransitAssistantIntent>([
  "eta",
  "delay",
  "weather",
  "traffic",
  "crowding",
  "navigation",
  "help",
  "out-of-scope",
]);

const DEFAULT_MODEL = "gemini-2.0-flash";

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

function isIntentDebugEnabled(): boolean {
  return process.env.GEMINI_INTENT_DEBUG === "true";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini intent response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

function normalizeIntentResult(value: unknown): TransitAssistantIntentResult {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini intent response was not an object");
  }

  const record = value as Record<string, unknown>;
  const intent = record.intent;
  const confidence = Number(record.confidence);

  if (typeof intent !== "string" || !VALID_INTENTS.has(intent as TransitAssistantIntent)) {
    throw new Error("Gemini intent response had an invalid intent");
  }

  return {
    intent: intent as TransitAssistantIntent,
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, Math.round(confidence)))
      : 60,
    reason: typeof record.reason === "string" ? record.reason : undefined,
  };
}

export async function classifyTransitAssistantIntent(
  input: string,
  context: TransitAssistantIntentContext = {},
): Promise<TransitAssistantIntentResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  );
  url.searchParams.set("key", apiKey);

  const prompt = [
    "Classify this TTC transit assistant user message into exactly one intent.",
    "Return only JSON with this schema: {\"intent\":\"eta|delay|weather|traffic|crowding|navigation|help|out-of-scope\",\"confidence\":0-100,\"reason\":\"short\"}.",
    "Intent meanings:",
    "- eta: arrival time, next bus/streetcar, route/stop timing.",
    "- delay: lateness, causes, accidents, construction, why slow.",
    "- weather: weather or weather impact.",
    "- traffic: road traffic or congestion impact.",
    "- crowding: passenger load, seats, packed vehicles.",
    "- navigation: directions, trip planning, how to get to a destination.",
    "- help: transit-related but missing needed details or clarification.",
    "- out-of-scope: not about TTC transit, commuting, routing, stops, traffic, weather, or crowding.",
    "Use context for follow-ups like 'what about now' or 'why'.",
    `Context: ${JSON.stringify(context)}`,
    `User message: ${input}`,
  ].join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    if (isIntentDebugEnabled()) {
      console.log("[milkbot intent error]", {
        input,
        context,
        model,
        status: response.status,
        details,
      });
    }
    throw new Error(`Gemini intent request failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini intent response was empty");
  }

  const result = normalizeIntentResult(extractJson(text));

  if (isIntentDebugEnabled()) {
    console.log("[milkbot intent]", {
      input,
      context,
      model,
      intent: result.intent,
      confidence: result.confidence,
      reason: result.reason,
    });
  }

  return result;
}
