/**
 * Generic Claude Vision wrapper: take an image + a prompt, get back parsed
 * JSON. The prompt is responsible for telling Claude what shape to return
 * and to return ONLY JSON (no markdown, no explanations) — this helper
 * strips common code-fence wrappers and parses the result.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export type SupportedMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const VALID_MEDIA_TYPES: SupportedMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export class ClaudeVisionError extends Error {
  constructor(
    msg: string,
    public statusCode: number,
    public raw?: string,
  ) {
    super(msg);
    this.name = "ClaudeVisionError";
  }
}

export interface ParseImageOptions {
  /** Anthropic API key. Falls back to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Model to use. Default: claude-haiku-4-5. Pass a Sonnet/Opus model for harder parses. */
  model?: string;
  /** Max output tokens. Default: 2048. */
  maxTokens?: number;
}

/**
 * Send an image (as Buffer or base64 string) plus a prompt to Claude and
 * return the parsed JSON response.
 *
 * The prompt MUST instruct Claude to return ONLY JSON. This helper strips
 * markdown code fences (```json ... ```) but won't recover from a model
 * that adds prose around the JSON.
 */
export async function parseImageWithClaude<T = unknown>(
  image: Buffer | string,
  mediaType: SupportedMediaType,
  prompt: string,
  opts: ParseImageOptions = {},
): Promise<T> {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeVisionError(
      "ANTHROPIC_API_KEY is not set (pass apiKey or set the env var)",
      500,
    );
  }

  if (!VALID_MEDIA_TYPES.includes(mediaType)) {
    throw new ClaudeVisionError(
      `Unsupported media type ${mediaType}. Use PNG, JPEG, GIF or WEBP.`,
      400,
    );
  }

  const base64 = Buffer.isBuffer(image) ? image.toString("base64") : image;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new ClaudeVisionError(
      errData?.error?.message || `Claude API error: ${response.status}`,
      response.status,
    );
  }

  const data = await response.json();
  const rawText: string = data.content?.[0]?.text?.trim() ?? "";

  // Strip ```json ... ``` and ``` ... ``` wrappers that Claude sometimes adds
  // even when explicitly told not to.
  const jsonStr = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new ClaudeVisionError(
      "Could not parse Claude's response as JSON",
      500,
      rawText,
    );
  }
}

/**
 * Convenience prompt builder for a monthly schedule image. Returns text
 * that asks Claude to map shifts in the image to YYYY-MM-DD dates for the
 * given month.
 *
 * Output shape: `{ shifts: [{ date, startTime, endTime }] }`
 */
export function buildSchedulePrompt(year: number, month: number): string {
  const MONTH_NAMES = [
    "",
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const DAY_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  const firstDay = new Date(year, month - 1, 1);
  const firstDayName = DAY_NAMES[firstDay.getDay()];
  const daysInMonth = new Date(year, month, 0).getDate();

  return `This is a work schedule for ${MONTH_NAMES[month]} ${year}.

Facts about the month:
- Month: ${month} (${MONTH_NAMES[month]}) ${year}
- Day 1 of the month is a ${firstDayName}
- The month has ${daysInMonth} days

The image shows a calendar. Columns are weekdays (Mon-Sun). Each cell with a shift contains two times: a start time (top) and an end time (bottom), e.g. "07:00" on the first row and "12:00" on the second.
Empty cells = day off, ignore them.

Use the day numbers visible in the calendar cells (1, 2, 3, ... ${daysInMonth}) and match them against ${MONTH_NAMES[month]} ${year} to compute the exact YYYY-MM-DD date.

Return ONLY valid JSON, no explanations, no markdown, no code blocks:
{"shifts":[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM"}]}

Include only days with actual times. Sort by date.`;
}
