// All database operations live here. Components and hooks should import
// from this module — never reach into Dexie directly. This keeps the
// data access layer one place to audit and means we can change the
// storage engine later without ripping up the UI.

import { db, SETTING_KEYS } from './schema';
import type {
  Recipe,
  RecipeWithRelations,
  RecipeDraft,
  Tag,
} from '../types';

// ─── Recipes ─────────────────────────────────────────────────────────────────

/**
 * Fetch a single recipe with its ingredients, steps, and tags.
 *
 * Returns `null` when the recipe doesn't exist — this lets callers using
 * dexie-react-hooks distinguish "not found" (null) from "still loading"
 * (undefined, which useLiveQuery returns until the query resolves).
 */
export async function getRecipeWithRelations(
  id: number,
): Promise<RecipeWithRelations | null> {
  const recipe = await db.recipes.get(id);
  if (!recipe) return null;

  const [ingredients, steps, tags] = await Promise.all([
    db.ingredients
      .where('recipeId')
      .equals(id)
      .sortBy('sortOrder'),
    db.steps
      .where('recipeId')
      .equals(id)
      .sortBy('stepNumber'),
    getTagsForRecipe(id),
  ]);

  return { ...recipe, ingredients, steps, tags };
}

/**
 * Fetch all recipes plus their ingredients and tag names. Used by the home
 * list — needed for ingredient/pantry filtering. Steps are NOT included
 * here: cards don't show them, and joining them is wasted work for large
 * libraries. Pull steps via getRecipeWithRelations on the detail screen.
 */
export async function listRecipesForHome(): Promise<
  Array<Recipe & { ingredients: { name: string }[]; tags: Tag[] }>
> {
  const recipes = await db.recipes.toArray();
  if (recipes.length === 0) return [];

  // Bulk-fetch related rows in two queries rather than N+1.
  const recipeIds = recipes.map((r) => r.id!).filter((id) => id !== undefined);

  const [allIngredients, allRecipeTags, allTags] = await Promise.all([
    db.ingredients.where('recipeId').anyOf(recipeIds).toArray(),
    db.recipeTags.where('recipeId').anyOf(recipeIds).toArray(),
    db.tags.toArray(),
  ]);

  const tagsById = new Map(allTags.map((t) => [t.id!, t]));

  return recipes.map((r) => {
    const ingredients = allIngredients
      .filter((i) => i.recipeId === r.id)
      .map((i) => ({ name: i.name }));
    const tagIds = allRecipeTags
      .filter((rt) => rt.recipeId === r.id)
      .map((rt) => rt.tagId);
    const tags = tagIds
      .map((id) => tagsById.get(id))
      .filter((t): t is Tag => t !== undefined);
    return { ...r, ingredients, tags };
  });
}

/**
 * Create a recipe with all its relations atomically. Throws on validation
 * failure (e.g. blank title) — the UI should validate before calling.
 */
export async function createRecipe(draft: RecipeDraft): Promise<number> {
  const title = draft.title.trim();
  if (!title) throw new Error('Title is required.');

  const now = Date.now();

  return db.transaction(
    'rw',
    [db.recipes, db.ingredients, db.steps, db.tags, db.recipeTags],
    async () => {
      const recipeId = await db.recipes.add({
        title,
        prepTimeMinutes: draft.prepTimeMinutes,
        cookTimeMinutes: draft.cookTimeMinutes,
        sourceUrl: draft.sourceUrl,
        notes: draft.notes,
        rating: draft.rating,
        createdAt: now,
        updatedAt: now,
        isStandardised: false,
      });

      await writeIngredientsAndSteps(recipeId, draft);
      await writeTagsForRecipe(recipeId, draft.tagNames);

      return recipeId;
    },
  );
}

/**
 * Update an existing recipe. Replaces all ingredients, steps and tag links.
 * The simpler "delete-and-reinsert" approach is fine for personal-scale data
 * and avoids fiddly diff logic.
 */
export async function updateRecipe(
  id: number,
  draft: RecipeDraft,
): Promise<void> {
  const title = draft.title.trim();
  if (!title) throw new Error('Title is required.');

  await db.transaction(
    'rw',
    [db.recipes, db.ingredients, db.steps, db.tags, db.recipeTags],
    async () => {
      const existing = await db.recipes.get(id);
      if (!existing) throw new Error(`Recipe ${id} not found.`);

      await db.recipes.update(id, {
        title,
        prepTimeMinutes: draft.prepTimeMinutes,
        cookTimeMinutes: draft.cookTimeMinutes,
        sourceUrl: draft.sourceUrl,
        notes: draft.notes,
        rating: draft.rating,
        updatedAt: Date.now(),
      });

      await db.ingredients.where('recipeId').equals(id).delete();
      await db.steps.where('recipeId').equals(id).delete();
      await db.recipeTags.where('recipeId').equals(id).delete();

      await writeIngredientsAndSteps(id, draft);
      await writeTagsForRecipe(id, draft.tagNames);
    },
  );
}

/**
 * Replace just the ingredients + steps of a recipe. Used by the
 * Recipe Standardisation flow (spec §6B.5). prepTime/cookTime are
 * overwritten only when newPrepMin/newCookMin are non-null.
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
  await db.transaction('rw', [db.recipes, db.ingredients, db.steps], async () => {
    const existing = await db.recipes.get(recipeId);
    if (!existing) throw new Error(`Recipe ${recipeId} not found.`);

    await db.ingredients.where('recipeId').equals(recipeId).delete();
    await db.steps.where('recipeId').equals(recipeId).delete();

    await db.ingredients.bulkAdd(
      ingredients.map((i) => ({ ...i, recipeId })),
    );
    await db.steps.bulkAdd(steps.map((s) => ({ ...s, recipeId })));

    const update: Partial<Recipe> = {
      isStandardised: true,
      updatedAt: Date.now(),
    };
    if (newPrepMin !== null) update.prepTimeMinutes = newPrepMin;
    if (newCookMin !== null) update.cookTimeMinutes = newCookMin;
    await db.recipes.update(recipeId, update);
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.recipes, db.ingredients, db.steps, db.recipeTags],
    async () => {
      await db.ingredients.where('recipeId').equals(id).delete();
      await db.steps.where('recipeId').equals(id).delete();
      await db.recipeTags.where('recipeId').equals(id).delete();
      await db.recipes.delete(id);
    },
  );
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export async function listAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('name').toArray();
}

export async function getTagsForRecipe(recipeId: number): Promise<Tag[]> {
  const links = await db.recipeTags.where('recipeId').equals(recipeId).toArray();
  if (links.length === 0) return [];
  const tagIds = links.map((l) => l.tagId);
  const tags = await db.tags.where('id').anyOf(tagIds).toArray();
  // Stable order by name for display.
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRecipeCountForTag(tagId: number): Promise<number> {
  return db.recipeTags.where('tagId').equals(tagId).count();
}

export async function renameTag(tagId: number, newName: string): Promise<void> {
  const normalised = newName.trim().toLowerCase();
  if (!normalised) throw new Error('Tag name is required.');
  await db.tags.update(tagId, { name: normalised });
}

export async function deleteTag(tagId: number): Promise<void> {
  await db.transaction('rw', [db.tags, db.recipeTags], async () => {
    await db.recipeTags.where('tagId').equals(tagId).delete();
    await db.tags.delete(tagId);
  });
}

// ─── Settings ────────────────────────────────────────────────────────────────

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

export async function getApiKey(): Promise<string | undefined> {
  return getSetting(SETTING_KEYS.GEMINI_API_KEY);
}

export async function setApiKey(value: string): Promise<void> {
  await setSetting(SETTING_KEYS.GEMINI_API_KEY, value);
}

export async function clearApiKey(): Promise<void> {
  await deleteSetting(SETTING_KEYS.GEMINI_API_KEY);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Insert ingredient + step rows for a recipe. Caller controls the transaction. */
async function writeIngredientsAndSteps(
  recipeId: number,
  draft: RecipeDraft,
): Promise<void> {
  if (draft.ingredients.length > 0) {
    await db.ingredients.bulkAdd(
      draft.ingredients.map((i, idx) => ({
        ...i,
        recipeId,
        sortOrder: i.sortOrder ?? idx,
      })),
    );
  }
  if (draft.steps.length > 0) {
    await db.steps.bulkAdd(
      draft.steps.map((s, idx) => ({
        ...s,
        recipeId,
        stepNumber: s.stepNumber ?? idx + 1,
      })),
    );
  }
}

/**
 * Resolve tag names → tag ids, creating missing tags. Then link them to
 * the recipe. Caller controls the transaction.
 */
async function writeTagsForRecipe(
  recipeId: number,
  rawNames: string[],
): Promise<void> {
  const names = Array.from(
    new Set(rawNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
  );
  if (names.length === 0) return;

  const existing = await db.tags.where('name').anyOf(names).toArray();
  const existingByName = new Map(existing.map((t) => [t.name, t]));

  const tagIds: number[] = [];
  for (const name of names) {
    const found = existingByName.get(name);
    if (found?.id !== undefined) {
      tagIds.push(found.id);
    } else {
      const newId = await db.tags.add({ name });
      tagIds.push(newId);
    }
  }

  await db.recipeTags.bulkAdd(tagIds.map((tagId) => ({ recipeId, tagId })));
}
