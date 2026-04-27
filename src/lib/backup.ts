// Backup / restore. Exports recipes + ingredients + steps + tags as
// JSON; imports the same shape with a "skip duplicates by title" merge.
//
// Migration note: previously read from / wrote to Dexie's local recipe
// tables. Now reads from / writes to Supabase. The JSON format is
// unchanged so backups taken before the migration are still importable.
//
// `deleteAllData` is kept as a Settings → Danger Zone action. It now
// wipes the *shared* Supabase library — every device sees the result.

import { supabase } from '../supabase/client';
import { DB_VERSION } from '../db';
import type { BackupFile, Recipe } from '../types';
import { normalise } from './utils';

// ─── Row shapes (snake_case from Postgres) ──────────────────────────────────

interface RecipeRow {
  id: number;
  title: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  source_url: string | null;
  notes: string | null;
  rating: number | null;
  created_at: number;
  updated_at: number;
  is_standardised: boolean;
}

interface IngredientRow {
  recipe_id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  notes: string | null;
  sort_order: number;
}

interface StepRow {
  recipe_id: number;
  step_number: number;
  instruction: string;
}

interface TagRow {
  id: number;
  name: string;
}

interface RecipeTagRow {
  recipe_id: number;
  tag_id: number;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportToJson(): Promise<BackupFile> {
  const [recipesResp, ingResp, stepResp, tagResp, recipeTagResp] =
    await Promise.all([
      supabase.from('recipes').select('*'),
      supabase.from('ingredients').select('*'),
      supabase.from('steps').select('*'),
      supabase.from('tags').select('*'),
      supabase.from('recipe_tags').select('*'),
    ]);

  if (recipesResp.error) throw new Error(recipesResp.error.message);
  if (ingResp.error) throw new Error(ingResp.error.message);
  if (stepResp.error) throw new Error(stepResp.error.message);
  if (tagResp.error) throw new Error(tagResp.error.message);
  if (recipeTagResp.error) throw new Error(recipeTagResp.error.message);

  const recipes = (recipesResp.data ?? []) as RecipeRow[];
  const ingredients = (ingResp.data ?? []) as IngredientRow[];
  const steps = (stepResp.data ?? []) as StepRow[];
  const tags = (tagResp.data ?? []) as TagRow[];
  const recipeTags = (recipeTagResp.data ?? []) as RecipeTagRow[];

  const tagsById = new Map(tags.map((t) => [t.id, t.name]));

  return {
    version: DB_VERSION,
    exportedAt: Date.now(),
    recipes: recipes.map((r) => ({
      title: r.title,
      prepTimeMinutes: r.prep_time_minutes,
      cookTimeMinutes: r.cook_time_minutes,
      sourceUrl: r.source_url,
      notes: r.notes,
      rating: r.rating,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isStandardised: r.is_standardised,
      ingredients: ingredients
        .filter((i) => i.recipe_id === r.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          notes: i.notes,
          sortOrder: i.sort_order,
        })),
      steps: steps
        .filter((s) => s.recipe_id === r.id)
        .sort((a, b) => a.step_number - b.step_number)
        .map((s) => ({
          stepNumber: s.step_number,
          instruction: s.instruction,
        })),
      tagNames: recipeTags
        .filter((rt) => rt.recipe_id === r.id)
        .map((rt) => tagsById.get(rt.tag_id))
        .filter((n): n is string => typeof n === 'string'),
    })),
  };
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date(backup.exportedAt)
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  a.download = `recipe-book-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  added: number;
  skipped: number;
  skippedTitles: string[];
}

/**
 * Validate-and-import. Skips recipes whose title already exists in the
 * library (case-insensitive). Tags are deduplicated against existing
 * tags by name.
 *
 * Note: this is no longer a single transaction. If the import is
 * interrupted partway, you may end up with some recipes added and others
 * not. Re-running the import is safe — already-imported titles are
 * skipped on the second pass.
 */
export async function importFromJson(raw: unknown): Promise<ImportResult> {
  if (!isObject(raw)) {
    throw new Error("That doesn't look like a recipe-book backup.");
  }
  if (typeof raw.version !== 'number') {
    throw new Error('Backup is missing a version number.');
  }
  if (raw.version > DB_VERSION) {
    throw new Error(
      `Backup is from a newer version of the app (v${raw.version}). Please update before importing.`,
    );
  }
  if (!Array.isArray(raw.recipes)) {
    throw new Error('Backup has no recipes.');
  }

  const result: ImportResult = { added: 0, skipped: 0, skippedTitles: [] };

  // Index existing recipes by lowercase title for the dedupe check.
  const { data: existingRows, error: existingErr } = await supabase
    .from('recipes')
    .select('title');
  if (existingErr) throw new Error(existingErr.message);

  const existingTitles = new Set(
    ((existingRows ?? []) as Array<{ title: string }>).map((r) => normalise(r.title)),
  );

  for (const item of raw.recipes as unknown[]) {
    if (!isObject(item)) continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;

    if (existingTitles.has(normalise(title))) {
      result.skipped += 1;
      result.skippedTitles.push(title);
      continue;
    }

    const now = Date.now();
    const recipeInsert: Omit<Recipe, 'id'> = {
      title,
      prepTimeMinutes: numericOrNull(item.prepTimeMinutes),
      cookTimeMinutes: numericOrNull(item.cookTimeMinutes),
      sourceUrl: stringOrNull(item.sourceUrl),
      notes: stringOrNull(item.notes),
      rating: ratingOrNull(item.rating),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
      isStandardised: item.isStandardised === true,
    };

    const { data: newRow, error: insertErr } = await supabase
      .from('recipes')
      .insert({
        title: recipeInsert.title,
        prep_time_minutes: recipeInsert.prepTimeMinutes,
        cook_time_minutes: recipeInsert.cookTimeMinutes,
        source_url: recipeInsert.sourceUrl,
        notes: recipeInsert.notes,
        rating: recipeInsert.rating,
        created_at: recipeInsert.createdAt,
        updated_at: recipeInsert.updatedAt,
        is_standardised: recipeInsert.isStandardised,
      })
      .select('id')
      .single();
    if (insertErr || !newRow) {
      throw new Error(
        `Failed to import "${title}": ${insertErr?.message ?? 'unknown error'}`,
      );
    }
    const recipeId = newRow.id as number;

    // Ingredients
    const rawIngredients = Array.isArray(item.ingredients) ? item.ingredients : [];
    if (rawIngredients.length > 0) {
      const rows = rawIngredients
        .filter(isObject)
        .map((ing, idx) => ({
          recipe_id: recipeId,
          quantity: stringOrNull(ing.quantity),
          unit: stringOrNull(ing.unit),
          name: typeof ing.name === 'string' ? ing.name.trim() : '',
          notes: stringOrNull(ing.notes),
          sort_order: typeof ing.sortOrder === 'number' ? ing.sortOrder : idx,
        }))
        .filter((row) => row.name.length > 0);
      if (rows.length > 0) {
        const { error: ingErr } = await supabase.from('ingredients').insert(rows);
        if (ingErr) throw new Error(ingErr.message);
      }
    }

    // Steps
    const rawSteps = Array.isArray(item.steps) ? item.steps : [];
    if (rawSteps.length > 0) {
      const rows = rawSteps
        .filter(isObject)
        .map((s, idx) => ({
          recipe_id: recipeId,
          step_number: typeof s.stepNumber === 'number' ? s.stepNumber : idx + 1,
          instruction: typeof s.instruction === 'string' ? s.instruction : '',
        }))
        .filter((row) => row.instruction.trim().length > 0);
      if (rows.length > 0) {
        const { error: stepErr } = await supabase.from('steps').insert(rows);
        if (stepErr) throw new Error(stepErr.message);
      }
    }

    // Tags: reuse existing by name, create missing.
    const tagNames = Array.isArray(item.tagNames)
      ? (item.tagNames as unknown[])
          .filter((n): n is string => typeof n === 'string')
          .map(normalise)
          .filter(Boolean)
      : [];
    if (tagNames.length > 0) {
      const uniqueNames = Array.from(new Set(tagNames));

      const { data: existingTags, error: existTagErr } = await supabase
        .from('tags')
        .select('*')
        .in('name', uniqueNames);
      if (existTagErr) throw new Error(existTagErr.message);

      const idByName = new Map(
        ((existingTags ?? []) as TagRow[]).map((t) => [t.name, t.id]),
      );

      const missing = uniqueNames.filter((n) => !idByName.has(n));
      if (missing.length > 0) {
        const { data: created, error: createErr } = await supabase
          .from('tags')
          .insert(missing.map((name) => ({ name })))
          .select('*');
        if (createErr) throw new Error(createErr.message);
        for (const t of (created ?? []) as TagRow[]) {
          idByName.set(t.name, t.id);
        }
      }

      const linkRows = uniqueNames
        .map((name) => idByName.get(name))
        .filter((id): id is number => id !== undefined)
        .map((tagId) => ({ recipe_id: recipeId, tag_id: tagId }));

      if (linkRows.length > 0) {
        const { error: linkErr } = await supabase
          .from('recipe_tags')
          .upsert(linkRows, {
            onConflict: 'recipe_id,tag_id',
            ignoreDuplicates: true,
          });
        if (linkErr) throw new Error(linkErr.message);
      }
    }

    existingTitles.add(normalise(title));
    result.added += 1;
  }

  return result;
}

// ─── Wipe everything ─────────────────────────────────────────────────────────

/**
 * Wipe every recipe, ingredient, step, tag, and recipe_tag. Used by
 * Settings → Danger Zone.
 *
 * IMPORTANT: this affects the *shared* library — every device sees the
 * result. The Settings UI's confirm dialog should make this clear.
 *
 * Settings (API key, theme override) live in local IndexedDB and are
 * NOT touched here.
 */
export async function deleteAllData(): Promise<void> {
  // Delete order respects foreign-key constraints, even though our
  // FKs cascade. Tags last because recipe_tags references them.
  // Note: Postgres needs a WHERE clause for DELETE under our setup.
  // We use a tautology that matches every row.
  const all = { name: 'never_matches_this_negation' }; // dummy, see below

  // We use .neq('id', 0) as a "match all" trick — every id is non-zero
  // because Postgres bigint identity columns start at 1.
  void all;

  await supabase.from('recipe_tags').delete().neq('id', 0);
  await supabase.from('ingredients').delete().neq('id', 0);
  await supabase.from('steps').delete().neq('id', 0);
  await supabase.from('recipes').delete().neq('id', 0);
  await supabase.from('tags').delete().neq('id', 0);
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function numericOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function ratingOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 && n <= 5 ? n : null;
}