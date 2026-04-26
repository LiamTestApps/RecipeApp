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

// ─── Internal ────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<ExtractedRecipe> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new GeminiError('no-api-key', 'No API key set.');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RECIPE_SCHEMA,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
    throw new GeminiError('network', 'Network request failed.');
  }
  clearTimeout(timeout);

  if (!response.ok) {
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

  return parseGeminiResponse(payload);
}

/**
 * Pull the JSON recipe out of Gemini's response envelope. The model is
 * supposed to return JSON in the schema we provided, but we still
 * validate every field defensively — schemas are best-effort, not
 * guaranteed.
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

  let recipeJson: unknown;
  try {
    recipeJson = JSON.parse(textPart.text);
  } catch {
    throw new GeminiError(
      'malformed-response',
      'Model output was not valid JSON.',
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
