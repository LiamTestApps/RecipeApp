// Backup / restore (Spec §9). Exports recipes + ingredients + steps + tags
// as JSON; imports the same shape with a "skip duplicates by title" merge.
//
// Schema version is included so future imports of older backups can be
// upgraded if needed.

import { db, DB_VERSION } from '../db';
import type { BackupFile, Recipe } from '../types';
import { normalise } from './utils';

/**
 * Build a plain-object representation of every recipe (including its
 * ingredients, steps, tags) for download. We strip database-level ids
 * because they're not portable across installs.
 */
export async function exportToJson(): Promise<BackupFile> {
  const [recipes, ingredients, steps, tags, recipeTags] = await Promise.all([
    db.recipes.toArray(),
    db.ingredients.toArray(),
    db.steps.toArray(),
    db.tags.toArray(),
    db.recipeTags.toArray(),
  ]);

  const tagsById = new Map(tags.map((t) => [t.id!, t.name]));

  return {
    version: DB_VERSION,
    exportedAt: Date.now(),
    recipes: recipes.map((r) => ({
      title: r.title,
      prepTimeMinutes: r.prepTimeMinutes,
      cookTimeMinutes: r.cookTimeMinutes,
      sourceUrl: r.sourceUrl,
      notes: r.notes,
      rating: r.rating,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isStandardised: r.isStandardised,
      ingredients: ingredients
        .filter((i) => i.recipeId === r.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((i) => ({
          quantity: i.quantity,
          unit: i.unit,
          name: i.name,
          notes: i.notes,
          sortOrder: i.sortOrder,
        })),
      steps: steps
        .filter((s) => s.recipeId === r.id)
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map((s) => ({
          stepNumber: s.stepNumber,
          instruction: s.instruction,
        })),
      tagNames: recipeTags
        .filter((rt) => rt.recipeId === r.id)
        .map((rt) => tagsById.get(rt.tagId))
        .filter((n): n is string => typeof n === 'string'),
    })),
  };
}

/** Trigger a browser download of the backup. */
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

export interface ImportResult {
  added: number;
  skipped: number;
  skippedTitles: string[];
}

/**
 * Validate-and-import. Skips recipes whose title already exists in the
 * library (case-insensitive). Doesn't touch existing data.
 *
 * Tags are deduplicated against existing tags by name.
 */
export async function importFromJson(
  raw: unknown,
): Promise<ImportResult> {
  if (!isObject(raw)) {
    throw new Error("That doesn't look like a recipe-book backup.");
  }
  if (typeof raw.version !== 'number') {
    throw new Error("Backup is missing a version number.");
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
  const existing = await db.recipes.toArray();
  const existingTitles = new Set(
    existing.map((r) => normalise(r.title)),
  );

  await db.transaction(
    'rw',
    [db.recipes, db.ingredients, db.steps, db.tags, db.recipeTags],
    async () => {
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
        const recipe: Omit<Recipe, 'id'> = {
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

        const recipeId = await db.recipes.add(recipe);

        const rawIngredients = Array.isArray(item.ingredients) ? item.ingredients : [];
        if (rawIngredients.length > 0) {
          await db.ingredients.bulkAdd(
            rawIngredients
              .filter(isObject)
              .map((ing, idx) => ({
                recipeId,
                quantity: stringOrNull(ing.quantity),
                unit: stringOrNull(ing.unit),
                name: typeof ing.name === 'string' ? ing.name.trim() : '',
                notes: stringOrNull(ing.notes),
                sortOrder:
                  typeof ing.sortOrder === 'number' ? ing.sortOrder : idx,
              }))
              .filter((ing) => ing.name.length > 0),
          );
        }

        const rawSteps = Array.isArray(item.steps) ? item.steps : [];
        if (rawSteps.length > 0) {
          await db.steps.bulkAdd(
            rawSteps
              .filter(isObject)
              .map((s, idx) => ({
                recipeId,
                stepNumber:
                  typeof s.stepNumber === 'number' ? s.stepNumber : idx + 1,
                instruction: typeof s.instruction === 'string' ? s.instruction : '',
              }))
              .filter((s) => s.instruction.trim().length > 0),
          );
        }

        // Tag handling: reuse existing tags by name, create missing ones.
        const tagNames = Array.isArray(item.tagNames)
          ? (item.tagNames as unknown[])
              .filter((n): n is string => typeof n === 'string')
              .map(normalise)
              .filter(Boolean)
          : [];
        if (tagNames.length > 0) {
          const uniqueNames = Array.from(new Set(tagNames));
          const existingTags = await db.tags
            .where('name')
            .anyOf(uniqueNames)
            .toArray();
          const idByName = new Map(existingTags.map((t) => [t.name, t.id!]));
          for (const name of uniqueNames) {
            if (!idByName.has(name)) {
              const id = await db.tags.add({ name });
              idByName.set(name, id);
            }
          }
          await db.recipeTags.bulkAdd(
            uniqueNames.map((name) => ({
              recipeId,
              tagId: idByName.get(name)!,
            })),
          );
        }

        existingTitles.add(normalise(title));
        result.added += 1;
      }
    },
  );

  return result;
}

/** Wipe every table. Used by Settings → Danger zone. */
export async function deleteAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.recipes, db.ingredients, db.steps, db.tags, db.recipeTags, db.settings],
    async () => {
      await db.recipes.clear();
      await db.ingredients.clear();
      await db.steps.clear();
      await db.tags.clear();
      await db.recipeTags.clear();
      // Note: we deliberately keep `settings` (e.g. API key) — wiping data
      // shouldn't make the user re-paste their key. There's a separate
      // "Remove API key" button for that.
    },
  );
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
