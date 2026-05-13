# claude-vision-image-parser

Generic wrapper for Anthropic's Vision API: take an image + a prompt, get back parsed JSON. Use it for any "user uploads a picture, we extract structured data" flow — schedules, invoices, receipts, timesheets, forms.

## What's included

- `lib/parse-image.ts` — `parseImageWithClaude()` + `buildSchedulePrompt()` + `ClaudeVisionError`
- `api/schedule-import.ts` — *optional* — reference Next.js route implementing schedule-from-image

## API

```ts
import {
  parseImageWithClaude,
  buildSchedulePrompt,
  ClaudeVisionError,
} from "@/lib/parse-image";

// 1) Schedule import (uses the bundled prompt)
const result = await parseImageWithClaude<{
  shifts: { date: string; startTime: string; endTime: string }[];
}>(buffer, "image/png", buildSchedulePrompt(2026, 5));

// 2) Custom prompt — bring your own
const invoice = await parseImageWithClaude<{
  vendor: string;
  invoiceNumber: string;
  total: number;
  lineItems: { description: string; amount: number }[];
}>(buffer, "image/jpeg", `
Extract the following fields from this invoice and return ONLY valid JSON:

{
  "vendor": "...",
  "invoiceNumber": "...",
  "total": 0,
  "lineItems": [{"description": "...", "amount": 0}]
}

No prose, no markdown, no code blocks. Just the JSON.
`);

// 3) With options
const big = await parseImageWithClaude(buffer, "image/png", prompt, {
  model: "claude-sonnet-4-6",   // bump for harder parses
  maxTokens: 4096,
});
```

## Errors

The helper throws `ClaudeVisionError` (with `statusCode` and optional `raw` text) for:
- Missing API key
- Unsupported media type
- HTTP errors from Anthropic
- JSON parse failure (response text in `raw`)

```ts
try {
  const data = await parseImageWithClaude(...);
} catch (err) {
  if (err instanceof ClaudeVisionError) {
    if (err.raw) console.log("Raw model output:", err.raw);
    return Response.json({ error: err.message }, { status: err.statusCode });
  }
  throw err;
}
```

## Reference: schedule-from-image route

`api/schedule-import.ts` shows the full flow:
1. Auth-gate the route
2. Read `multipart/form-data` with an `image` field plus `year` + `month`
3. Validate media type
4. Call `parseImageWithClaude` with `buildSchedulePrompt(year, month)`
5. Return the shifts list

To adapt for invoices: copy the route, swap `buildSchedulePrompt(...)` for your own prompt, change the response type. The auth + form parsing stay.

## Prompt tips

The helper strips `\`\`\`json ... \`\`\`` and `\`\`\` ... \`\`\`` wrappers (Claude still adds these sometimes even when told not to). It does *not* recover from prose around the JSON, so:

- Be explicit: "Return ONLY valid JSON, no explanations, no markdown, no code blocks."
- Spell out the exact shape — Claude sticks closer when the schema is right there in the prompt.
- For low-stakes parses, use `claude-haiku-4-5` (default; cheap and fast). Bump to Sonnet for ambiguous images, Opus for the hardest cases.
- Provide context where you can: month + first-day-of-week + day count for schedules, vendor list for invoices, etc. Reduces hallucination on ambiguous cells.

## Dependencies on other modules

- `auth-nextauth` — for `getServerSession` in the bundled route. Drop the auth check if you want a public endpoint (don't — Vision calls cost money).

## Customization

- **Model** — `opts.model` per-call, default `claude-haiku-4-5-20251001`.
- **Max tokens** — `opts.maxTokens` per-call, default 2048. Schedules with 31 entries fit in 1.2k; invoices with many line items may need more.
- **API key** — `opts.apiKey` per-call, falls back to `ANTHROPIC_API_KEY`.
- **Streaming** — not built in. If you want token-by-token output, drop the helper and call the SDK directly.
