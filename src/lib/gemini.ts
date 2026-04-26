// Gemini API client.
//
// Spec §6: Smart Extract (paste recipe text → structured fields) and
// Standardise (clean up an existing recipe's ingredients/steps) both
// call Gemini Flash with structured JSON output. They share this client.
//
// Design notes:
//  - All errors are GeminiError instances with a discriminated `kind`
//    so the UI can render specific messages (no key vs network vs
//    rate limit vs malformed JSON).
//  - We use the `generationConfig.responseMimeType: 'application/json'`
//    + `responseSchema` mode so Gemini guarantees parseable JSON instead
//    of free-text-with-fences.
//  - 30-second timeout. Mobile networks aren't always great; without a
//    timeout the spinner can hang forever.
//
// IMPORTANT: 'gemini-2.0-flash' (named in the original spec) shuts down
// June 1 2026. We use 'gemini-2.5-flash' — same speed/cost tier, current
// stable, no deprecation date, has a free tier.

import { getApiKey } from '../db';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

// ─── Errors ──────────────────────────────────────────────────────────────────

export type GeminiErrorKind =
  | 'no-api-key'
  | 'invalid-api-key'
  | 'invalid-url'
  | 'url-fetch-failed'
  | 'rate-limited'
  | 'network'
  | 'timeout'
  | 'server-error'
  | 'malformed-response'
  | 'safety-blocked'
  | 'unknown';

export class GeminiError extends Error {
  kind: GeminiErrorKind;
  constructor(kind: GeminiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'GeminiError';
  }
}

/** User-friendly messages keyed off the error kind. */
export function messageForError(err: unknown): string {
  if (err instanceof GeminiError) {
    switch (err.kind) {
      case 'no-api-key':
        return 'Add a Gemini API key in Settings to use AI features.';
      case 'invalid-api-key':
        return 'That API key was rejected. Check it in Settings.';
      case 'invalid-url':
        return err.message; // already user-friendly; produced by extractFromUrl
      case 'url-fetch-failed':
        return "Gemini couldn't load that page (some sites block automated access). Try a different recipe URL, or use Smart Extract with the recipe text instead.";
      case 'rate-limited':
        return 'Too many requests. Try again in a minute.';
      case 'network':
        return 'No internet connection. AI features need to reach Google.';
      case 'timeout':
        return 'The request took too long. Try again.';
      case 'server-error':
        return 'Google had a problem. Try again in a moment.';
      case 'malformed-response':
        return "Couldn't make sense of the AI's reply. Try again.";
      case 'safety-blocked':
        return 'The AI declined to respond to that input.';
      default:
        return err.message || 'Something went wrong.';
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// ─── JSON Schemas ────────────────────────────────────────────────────────────

/**
 * Schema for the structured recipe Gemini returns. This is the shape we
 * tell Gemini to produce; we re-validate on receipt because schemas are
 * a hint, not a contract.
 */
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    prepTimeMinutes: { type: 'integer', nullable: true },
    cookTimeMinutes: { type: 'integer', nullable: true },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quantity: { type: 'string', nullable: true },
          unit: { type: 'string', nullable: true },
          name: { type: 'string' },
          notes: { type: 'string', nullable: true },
        },
        required: ['name'],
      },
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'ingredients', 'steps'],
};

// ─── Public types ────────────────────────────────────────────────────────────

export interface ExtractedRecipe {
  title: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  ingredients: Array<{
    quantity: string | null;
    unit: string | null;
    name: string;
    notes: string | null;
  }>;
  steps: string[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Smart Extract — pastes recipe text, returns structured recipe.
 * Used by the New Recipe form's "✨ Smart Extract" button.
 */
export async function smartExtract(
  rawText: string,
): Promise<ExtractedRecipe> {
  const prompt = `You are a recipe parser. Extract the structured recipe from the following text.

Rules:
- Preserve quantities exactly as written (including fractions like "1/2" or ranges like "1-2"). Use null when no quantity is given.
- Preserve units in their original form ("cup", "g", "tbsp", etc.). Use null when there is no unit.
- Put the bare ingredient name in "name" (e.g. "onion", not "1 large onion, finely chopped"). Put descriptors like "finely chopped", "large", "ripe" into "notes".
- Steps should be concise, one per logical action. Don't merge unrelated steps.
- Times are in minutes. Use null if not stated.
- Do not invent details. If something isn't in the source, leave it null/empty.

Recipe text:
---
${rawText.trim()}
---`;

  return callGemini(prompt);
}

/**
 * Standardise — pass an existing recipe's text representation and get
 * back a cleaned-up version. Used by the Detail page's "✨ Standardise" button.
 */
export async function standardiseRecipe(
  title: string,
  ingredientsText: string,
  stepsText: string,
  prepMin: number | null,
  cookMin: number | null,
): Promise<ExtractedRecipe> {
  const prompt = `You are a recipe editor. Clean up and standardise the following recipe.

Rules:
- Keep the meaning and method exactly the same. Do not invent steps or ingredients.
- Normalise units (e.g. "tbsp" not "tablespoon"; "g" not "grams").
- Split combined ingredient lines into separate entries where reasonable.
- Move descriptors out of "name" into "notes" (e.g. "1 onion, finely chopped" → name "onion", notes "finely chopped").
- Split run-on instruction steps into discrete numbered steps.
- Preserve original times. If times are missing, leave them null — don't guess.

Title: ${title}
Prep: ${prepMin ?? 'not specified'} min
Cook: ${cookMin ?? 'not specified'} min

Ingredients:
${ingredientsText}

Steps:
${stepsText}`;

  return callGemini(prompt);
}

/**
 * Test whether an API key is accepted, without using one of the user's
 * Gemini quota slots on a real generation. We hit the lightweight
 * `models/<model>` endpoint, which 200s if the key is valid.
 *
 * The key isn't read from settings here — the caller passes the
 * candidate value, so the user can validate before saving.
 */
export async function testApiKey(candidateKey: string): Promise<boolean> {
  if (!candidateKey.trim()) return false;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}?key=${encodeURIComponent(candidateKey.trim())}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

/**
 * Extract a recipe from a URL. Gemini's URL Context tool fetches the page
 * server-side (no CORS issue), then the model parses it into our schema.
 *
 * Throws GeminiError with kind:
 *   - 'no-api-key'        — user hasn't set a key
 *   - 'invalid-url'       — couldn't even parse the input as a URL
 *   - 'network'           — Gemini couldn't fetch the page (or our fetch failed)
 *   - 'malformed-response'— page didn't contain a recognisable recipe
 *   - the usual auth/rate/safety errors
 */
export async function extractFromUrl(rawUrl: string): Promise<ExtractedRecipe> {
  const url = rawUrl.trim();

  // Cheap client-side URL validation. Saves a Gemini call when the user
  // pastes garbage or accidentally double-pastes.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new GeminiError('invalid-url', "That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new GeminiError('invalid-url', 'URL must start with http:// or https://');
  }

  // Note: no responseSchema here — see CallOptions doc. The prompt does
  // the schema's job by being very explicit about output shape.
  const prompt = `Visit the URL below and extract the recipe.

URL: ${url}

Return ONLY a JSON object with this exact shape — no markdown fences, no commentary, no leading or trailing text:

{
  "title": "string — recipe title",
  "prepTimeMinutes": number or null,
  "cookTimeMinutes": number or null,
  "ingredients": [
    {
      "quantity": "string or null — preserve fractions like '1/2' and ranges like '1-2'",
      "unit": "string or null — keep the original unit (cup, g, tbsp, etc.)",
      "name": "string — bare ingredient name only (e.g. 'onion', not '1 large onion, finely chopped')",
      "notes": "string or null — descriptors like 'finely chopped', 'large', 'ripe'"
    }
  ],
  "steps": ["string", "string", "..."]
}

Rules:
- Do not invent details. If the page doesn't say a time, use null.
- Steps are an array of strings, one step per logical action.
- If the page is not a recipe (e.g. a blog index, an article, a 404 page), return {"title":"","ingredients":[],"steps":[]}.`;

  return callGemini(prompt, { withUrlContext: true, timeoutMs: 60_000 });
}

// ─── Internal ────────────────────────────────────────────────────────────────

interface CallOptions {
  /**
   * Whether to enable Gemini's URL Context tool, which lets the model
   * fetch arbitrary web pages itself (no CORS).
   *
   * Important: on gemini-2.5-flash, the URL Context tool does NOT
   * compose with `responseSchema` — Google only released that combo
   * in the Gemini 3 series. So when this is true, we skip schema-mode
   * and rely on prompt-level "return JSON only" instruction +
   * defensive parsing.
   */
  withUrlContext?: boolean;
  /** Larger timeout for URL fetches — pages can be slow. */
  timeoutMs?: number;
}

async function callGemini(
  prompt: string,
  options: CallOptions = {},
): Promise<ExtractedRecipe> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new GeminiError('no-api-key', 'No API key set.');

  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
  };
  // Schema mode and URL-context tool are mutually exclusive on 2.5-flash.
  if (!options.withUrlContext) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = RECIPE_SCHEMA;
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (options.withUrlContext) {
    body.tools = [{ url_context: {} }];
  }

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeminiError('timeout', 'Request timed out.');
    }
    // Log the underlying fetch error so the browser console shows the
    // actual TypeError / cause (DNS, TLS, blocked, etc.) instead of just
    // the generic "Network request failed".
    console.error('[gemini] fetch failed:', err);
    throw new GeminiError('network', 'Network request failed.');
  }
  clearTimeout(timeout);

  if (!response.ok) {
    // Log the body so the console reveals exactly what Google returned
    // (often a structured error message we'd otherwise mask behind our
    // generic codes).
    try {
      const errBody = await response.clone().text();
      console.error(
        `[gemini] HTTP ${response.status}:`,
        errBody.slice(0, 500),
      );
    } catch {
      // ignore
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new GeminiError('invalid-api-key', `API key rejected (${response.status}).`);
    }
    if (response.status === 429) {
      throw new GeminiError('rate-limited', 'Rate limit hit.');
    }
    throw new GeminiError('server-error', `Gemini returned ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GeminiError('malformed-response', 'Response was not valid JSON.');
  }

  return parseGeminiResponseWithLogging(payload);
}

function parseGeminiResponseWithLogging(payload: unknown): ExtractedRecipe {
  try {
    return parseGeminiResponse(payload);
  } catch (err) {
    // Dump the raw payload so we can see exactly what Gemini returned
    // when something didn't parse. Useful for debugging URL fetches
    // that succeed at the HTTP level but produce unexpected content.
    if (err instanceof GeminiError && err.kind !== 'safety-blocked') {
      console.error(
        '[gemini] response parse failed (' + err.kind + '). Payload:',
        payload,
      );
    }
    throw err;
  }
}

/**
 * Pull the JSON recipe out of Gemini's response envelope. The model is
 * supposed to return JSON in the schema we provided, but we still
 * validate every field defensively — schemas are best-effort, not
 * guaranteed, and url-context mode skips schema entirely.
 */
function parseGeminiResponse(payload: unknown): ExtractedRecipe {
  if (!isObject(payload)) {
    throw new GeminiError('malformed-response', 'Unexpected response shape.');
  }

  // Safety filters can block a response. The candidates array will be
  // empty and there'll be a promptFeedback.blockReason.
  const promptFeedback = payload.promptFeedback;
  if (
    isObject(promptFeedback) &&
    typeof promptFeedback.blockReason === 'string'
  ) {
    throw new GeminiError(
      'safety-blocked',
      `Blocked: ${promptFeedback.blockReason}`,
    );
  }

  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new GeminiError('malformed-response', 'No candidates returned.');
  }

  const first = candidates[0];
  if (!isObject(first)) {
    throw new GeminiError('malformed-response', 'Bad candidate.');
  }

  // Per-candidate finish/safety reasons.
  if (first.finishReason === 'SAFETY' || first.finishReason === 'PROHIBITED_CONTENT') {
    throw new GeminiError('safety-blocked', 'Content blocked by safety filter.');
  }

  // URL Context tool reports per-URL retrieval status. If we asked it to
  // fetch a page and the fetch failed (404, blocked, etc.) we want a
  // specific error message rather than letting the JSON parser fail
  // mysteriously on an explanation paragraph.
  const urlMeta =
    (isObject(first.urlContextMetadata) && first.urlContextMetadata) ||
    (isObject(first.url_context_metadata) && first.url_context_metadata);
  if (urlMeta) {
    const list = Array.isArray(urlMeta.urlMetadata)
      ? urlMeta.urlMetadata
      : Array.isArray(urlMeta.url_metadata)
        ? urlMeta.url_metadata
        : [];
    const failed = list.find(
      (m: unknown) =>
        isObject(m) &&
        (m.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_ERROR' ||
          m.url_retrieval_status === 'URL_RETRIEVAL_STATUS_ERROR'),
    );
    if (failed) {
      throw new GeminiError(
        'url-fetch-failed',
        "Couldn't fetch that page.",
      );
    }
  }

  const content = first.content;
  if (!isObject(content) || !Array.isArray(content.parts)) {
    throw new GeminiError('malformed-response', 'Missing content parts.');
  }

  const textPart = content.parts.find(
    (p: unknown) => isObject(p) && typeof p.text === 'string',
  );
  if (!isObject(textPart) || typeof textPart.text !== 'string') {
    throw new GeminiError('malformed-response', 'No text in response.');
  }

  // In url-context mode (no responseSchema), the model often wraps JSON
  // in markdown fences (```json ... ```) despite our prompt telling it
  // not to. Strip them before parsing.
  const cleaned = stripJsonFences(textPart.text);

  let recipeJson: unknown;
  try {
    recipeJson = JSON.parse(cleaned);
  } catch {
    throw new GeminiError(
      'malformed-response',
      "Couldn't find a recipe on that page.",
    );
  }

  return validateExtractedRecipe(recipeJson);
}

function validateExtractedRecipe(value: unknown): ExtractedRecipe {
  if (!isObject(value)) {
    throw new GeminiError('malformed-response', 'Recipe was not an object.');
  }

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  if (!title) {
    throw new GeminiError('malformed-response', 'Missing recipe title.');
  }

  const prepTimeMinutes = numericOrNull(value.prepTimeMinutes);
  const cookTimeMinutes = numericOrNull(value.cookTimeMinutes);

  const rawIngredients = Array.isArray(value.ingredients) ? value.ingredients : [];
  const ingredients = rawIngredients
    .map((raw) => {
      if (!isObject(raw)) return null;
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name) return null;
      return {
        quantity: stringOrNull(raw.quantity),
        unit: stringOrNull(raw.unit),
        name,
        notes: stringOrNull(raw.notes),
      };
    })
    .filter((x): x is ExtractedRecipe['ingredients'][number] => x !== null);

  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  const steps = rawSteps
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);

  return { title, prepTimeMinutes, cookTimeMinutes, ingredients, steps };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numericOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Remove markdown code fences if the model wrapped its JSON in them.
 * The fence might be ```json ... ``` or just ``` ... ```. Anything before
 * the opening fence or after the closing fence is also stripped.
 */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  // Look for an opening fence anywhere in the text.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}
