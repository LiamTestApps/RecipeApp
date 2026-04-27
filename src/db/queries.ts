// All database operations live here. Components and hooks should import
// from this module — never reach into Supabase directly. This keeps the
// data access layer one place to audit.
//
// Migration note: this file used to be backed by Dexie/IndexedDB. As of
// the Supabase migration, recipes/ingredients/steps/tags live in
// Postgres. Settings (API key, theme) intentionally stay in IndexedDB
// because they're per-device, not per-library.
//
// Field-naming bridge: Postgres uses snake_case, the app uses camelCase.
// Translation happens at this boundary — every function returns shapes
// that the UI already expects.

import { supabase } from '../supabase/client';
import { db, SETTING_KEYS } from './schema';
import type {
  Recipe,
  RecipeWithRelations,
  RecipeDraft,
  Tag,
  Ingredient,
  Step,
} from '../types';

// ─── Row shapes (snake_case as Postgres returns them) ───────────────────────

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
  id: number;
  recipe_id: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  notes: string | null;
  sort_order: number;
}

interface StepRow {
  id: number;
  recipe_id: number;
  step_number: number;
  instruction: string;
}

interface TagRow {
  id: number;
  name: string;
}

// ─── snake → camel mappers ───────────────────────────────────────────────────

function mapRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    prepTimeMinutes: row.prep_time_minutes,
    cookTimeMinutes: row.cook_time_minutes,
    sourceUrl: row.source_url,
    notes: row.notes,
    rating: row.rating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isStandardised: row.is_standardised,
  };
}

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    quantity: row.quantity,
    unit: row.unit,
    name: row.name,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

function mapStep(row: StepRow): Step {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    stepNumber: row.step_number,
    instruction: row.instruction,
  };
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

export async function getRecipeWithRelations(
  id: number,
): Promise<RecipeWithRelations | null> {
  // Fetch the recipe + relations in parallel. The recipe query also
  // doubles as our "exists?" check — null means not-found.
  const [
    { data: recipeRow, error: recipeErr },
    { data: ingRows, error: ingErr },
    { data: stepRows, error: stepErr },
    tags,
  ] = await Promise.all([
    supabase.from('recipes').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('ingredients')
      .select('*')
      .eq('recipe_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('steps')
      .select('*')
      .eq('recipe_id', id)
      .order('step_number', { ascending: true }),
    getTagsForRecipe(id),
  ]);

  if (recipeErr) throw new Error(recipeErr.message);
  if (!recipeRow) return null;
  if (ingErr) throw new Error(ingErr.message);
  if (stepErr) throw new Error(stepErr.message);

  return {
    ...mapRecipe(recipeRow as RecipeRow),
    ingredients: (ingRows ?? []).map((r) => mapIngredient(r as IngredientRow)),
    steps: (stepRows ?? []).map((r) => mapStep(r as StepRow)),
    tags,
  };
}

/**
 * Fetch all recipes plus their ingredients and tag names. Used by the home
 * list — needed for ingredient/pantry filtering. Steps are NOT included
 * here for the same reason as before: cards don't show them.
 *
 * Dexie's `anyOf(...)` had to be replaced with Postgres's `in()` filter.
 * Conceptually identical — bulk-fetch related rows in two queries instead
 * of N+1 individual queries.
 */
export async function listRecipesForHome(): Promise <
  Array<Recipe & { ingredients: { name: string }[]; tags: Tag[] }>
> {
  const { data: recipeRows, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!recipeRows || recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((r) => r.id as number);

  const [ingResp, recipeTagResp, tagResp] = await Promise.all([
    supabase.from('ingredients').select('recipe_id, name').in('recipe_id', recipeIds),
    supabase
      .from('recipe_tags')
      .select('recipe_id, tag_id')
      .in('recipe_id', recipeIds),
    supabase.from('tags').select('*'),
  ]);
  if (ingResp.error) throw new Error(ingResp.error.message);
  if (recipeTagResp.error) throw new Error(recipeTagResp.error.message);
  if (tagResp.error) throw new Error(tagResp.error.message);

  const ingredients = (ingResp.data ?? []) as Array<{ recipe_id: number; name: string }>;
  const recipeTagLinks = (recipeTagResp.data ?? []) as Array<{
    recipe_id: number;
    tag_id: number;
  }>;
  const allTags = (tagResp.data ?? []) as TagRow[];

  const tagsById = new Map<number, Tag>(
    allTags.map((t) => [t.id, { id: t.id, name: t.name }]),
  );

  return recipeRows.map((row) => {
    const recipe = mapRecipe(row as RecipeRow);
    const ings = ingredients
      .filter((i) => i.recipe_id === recipe.id)
      .map((i) => ({ name: i.name }));
    const tagIds = recipeTagLinks
      .filter((rt) => rt.recipe_id === recipe.id)
      .map((rt) => rt.tag_id);
    const tags = tagIds
      .map((id) => tagsById.get(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
    return { ...recipe, ingredients: ings, tags };
  });
}

/**
 * Create a recipe with all its relations.
 *
 * Migration note: this used to be a single Dexie transaction. Supabase
 * doesn't expose multi-statement transactions to the client, so this is
 * now a sequence of inserts. If the network dies between the recipe
 * insert and the ingredients insert, the recipe ends up half-saved.
 * Realistic failure rate is low for a personal app; the cure (a
 * Postgres function) isn't worth the complexity yet.
 */
export async function createRecipe(draft: RecipeDraft): Promise<number> {
  const title = draft.title.trim();
  if (!title) throw new Error('Title is required.');

  const now = Date.now();

  const { data: recipeRow, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      title,
      prep_time_minutes: draft.prepTimeMinutes,
      cook_time_minutes: draft.cookTimeMinutes,
      source_url: draft.sourceUrl,
      notes: draft.notes,
      rating: draft.rating,
      created_at: now,
      updated_at: now,
      is_standardised: false,
    })
    .select('id')
    .single();

  if (recipeErr || !recipeRow) {
    throw new Error(recipeErr?.message ?? 'Failed to create recipe.');
  }
  const recipeId = recipeRow.id as number;

  await writeIngredientsAndSteps(recipeId, draft);
  await writeTagsForRecipe(recipeId, draft.tagNames);

  return recipeId;
}

/**
 * Update an existing recipe. Replaces all ingredients, steps and tag links.
 * Same delete-and-reinsert pattern as before — fine for personal-scale data.
 */
export async function updateRecipe(
  id: number,
  draft: RecipeDraft,
): Promise<void> {
  const title = draft.title.trim();
  if (!title) throw new Error('Title is required.');

  const { error: existsErr, data: existingRow } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existsErr) throw new Error(existsErr.message);
  if (!existingRow) throw new Error(`Recipe ${id} not found.`);

  const { error: updateErr } = await supabase
    .from('recipes')
    .update({
      title,
      prep_time_minutes: draft.prepTimeMinutes,
      cook_time_minutes: draft.cookTimeMinutes,
      source_url: draft.sourceUrl,
      notes: draft.notes,
      rating: draft.rating,
      updated_at: Date.now(),
    })
    .eq('id', id);
  if (updateErr) throw new Error(updateErr.message);

  // Wipe the old children. The cascade-delete is a foreign-key on the
  // child tables, so the rows are removed cleanly.
  await Promise.all([
    supabase.from('ingredients').delete().eq('recipe_id', id),
    supabase.from('steps').delete().eq('recipe_id', id),
    supabase.from('recipe_tags').delete().eq('recipe_id', id),
  ]);

  await writeIngredientsAndSteps(id, draft);
  await writeTagsForRecipe(id, draft.tagNames);
}

/**
 * Replace just the ingredients + steps of a recipe. Used by the
 * Recipe Standardisation flow. prepTime/cookTime are overwritten only
 * when the new values are non-null.
 */
export async function applyStandardisation(
  recipeId: number,
  ingredients: Array<{
    quantity: string | null;
    unit: string | null;
    name: string;
    notes: string | null;
    sortOrder: number;
  }>,
  steps: Array<{ stepNumber: number; instruction: string }>,
  newPrepMin: number | null,
  newCookMin: number | null,
): Promise<void> {
  const { data: existing, error: existsErr } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .maybeSingle();
  if (existsErr) throw new Error(existsErr.message);
  if (!existing) throw new Error(`Recipe ${recipeId} not found.`);

  await Promise.all([
    supabase.from('ingredients').delete().eq('recipe_id', recipeId),
    supabase.from('steps').delete().eq('recipe_id', recipeId),
  ]);

  if (ingredients.length > 0) {
    const { error: ingErr } = await supabase.from('ingredients').insert(
      ingredients.map((i) => ({
        recipe_id: recipeId,
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        notes: i.notes,
        sort_order: i.sortOrder,
      })),
    );
    if (ingErr) throw new Error(ingErr.message);
  }

  if (steps.length > 0) {
    const { error: stepErr } = await supabase.from('steps').insert(
      steps.map((s) => ({
        recipe_id: recipeId,
        step_number: s.stepNumber,
        instruction: s.instruction,
      })),
    );
    if (stepErr) throw new Error(stepErr.message);
  }

  const update: Record<string, unknown> = {
    is_standardised: true,
    updated_at: Date.now(),
  };
  if (newPrepMin !== null) update.prep_time_minutes = newPrepMin;
  if (newCookMin !== null) update.cook_time_minutes = newCookMin;

  const { error: updateErr } = await supabase
    .from('recipes')
    .update(update)
    .eq('id', recipeId);
  if (updateErr) throw new Error(updateErr.message);
}

export async function deleteRecipe(id: number): Promise<void> {
  // Foreign keys with ON DELETE CASCADE handle ingredients/steps/recipe_tags
  // for us — a single delete on `recipes` cascades.
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
// ─── Tags ────────────────────────────────────────────────────────────────────

export async function listAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: (row as TagRow).id,
    name: (row as TagRow).name,
  }));
}

export async function getTagsForRecipe(recipeId: number): Promise<Tag[]> {
  const { data: links, error: linksErr } = await supabase
    .from('recipe_tags')
    .select('tag_id')
    .eq('recipe_id', recipeId);
  if (linksErr) throw new Error(linksErr.message);
  if (!links || links.length === 0) return [];

  const tagIds = (links as Array<{ tag_id: number }>).map((l) => l.tag_id);

  const { data: tags, error: tagsErr } = await supabase
    .from('tags')
    .select('*')
    .in('id', tagIds);
  if (tagsErr) throw new Error(tagsErr.message);

  return ((tags ?? []) as TagRow[])
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRecipeCountForTag(tagId: number): Promise<number> {
  const { count, error } = await supabase
    .from('recipe_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function renameTag(tagId: number, newName: string): Promise<void> {
  const normalised = newName.trim().toLowerCase();
  if (!normalised) throw new Error('Tag name is required.');
  const { error } = await supabase
    .from('tags')
    .update({ name: normalised })
    .eq('id', tagId);
  if (error) throw new Error(error.message);
}

export async function deleteTag(tagId: number): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', tagId);
  if (error) throw new Error(error.message);
}

// ─── Settings (still local — IndexedDB) ──────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.get(key);
  return row?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

export async function getApiKey(): Promise<string | null> {
  const value = await getSetting(SETTING_KEYS.GEMINI_API_KEY);
  return value ?? null;
}

export async function setApiKey(value: string): Promise<void> {
  await setSetting(SETTING_KEYS.GEMINI_API_KEY, value);
}

export async function clearApiKey(): Promise<void> {
  await deleteSetting(SETTING_KEYS.GEMINI_API_KEY);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function writeIngredientsAndSteps(
  recipeId: number,
  draft: RecipeDraft,
): Promise<void> {
  if (draft.ingredients.length > 0) {
    const { error } = await supabase.from('ingredients').insert(
      draft.ingredients.map((i, idx) => ({
        recipe_id: recipeId,
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        notes: i.notes,
        sort_order: i.sortOrder ?? idx,
      })),
    );
    if (error) throw new Error(error.message);
  }
  if (draft.steps.length > 0) {
    const { error } = await supabase.from('steps').insert(
      draft.steps.map((s, idx) => ({
        recipe_id: recipeId,
        step_number: s.stepNumber ?? idx + 1,
        instruction: s.instruction,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

async function writeTagsForRecipe(
  recipeId: number,
  rawNames: string[],
): Promise<void> {
  const names = Array.from(
    new Set(rawNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
  );
  if (names.length === 0) return;

  const { data: existing, error: existingErr } = await supabase
    .from('tags')
    .select('*')
    .in('name', names);
  if (existingErr) throw new Error(existingErr.message);

  const existingByName = new Map(
    ((existing ?? []) as TagRow[]).map((t) => [t.name, t.id]),
  );

  const missing = names.filter((n) => !existingByName.has(n));
  if (missing.length > 0) {
    const { data: created, error: createErr } = await supabase
      .from('tags')
      .insert(missing.map((name) => ({ name })))
      .select('*');
    if (createErr) throw new Error(createErr.message);
    for (const t of (created ?? []) as TagRow[]) {
      existingByName.set(t.name, t.id);
    }
  }

  const tagIds = names
    .map((n) => existingByName.get(n))
    .filter((id): id is number => id !== undefined);

  const { error: linkErr } = await supabase
    .from('recipe_tags')
    .upsert(tagIds.map((tagId) => ({ recipe_id: recipeId, tag_id: tagId })), {
      onConflict: 'recipe_id,tag_id',
      ignoreDuplicates: true,
    });
  if (linkErr) throw new Error(linkErr.message);
}