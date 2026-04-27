// Dexie schema for the recipe app's *local-only* data.
//
// Recipes/ingredients/steps/tags moved to Supabase as part of the migration
// to a shared library. This file now only manages per-device settings:
// the Gemini API key and the theme override. These are intentionally
// local — they're per-user-of-this-browser, not part of the shared
// recipe library.
//
// Migration history:
//   v1: full schema (recipes, ingredients, steps, tags, recipe_tags, settings)
//   v2: redefined to shrink the local DB to just settings; existing
//       local recipe data is left in place (Dexie ignores tables not
//       declared in the latest version) but the app no longer reads it.

import Dexie, { type Table } from 'dexie';
import type { Setting } from '../types';

export const DB_VERSION = 2;

export const SETTING_KEYS = {
  GEMINI_API_KEY: 'geminiApiKey',
  THEME_OVERRIDE: 'themeOverride',
} as const;

class LocalDB extends Dexie {
  settings!: Table<Setting, string>;

  constructor() {
    super('RecipeBookDB');

    // Original schema. Kept here so existing users' DBs upgrade cleanly.
    this.version(1).stores({
      recipes: '++id, title, rating, createdAt',
      ingredients: '++id, recipeId, name',
      steps: '++id, recipeId',
      tags: '++id, &name',
      recipeTags: '++id, &[recipeId+tagId], recipeId, tagId',
      settings: '&key',
    });

    // v2: only the settings table is declared. The other stores still
    // physically exist in any v1 user's IndexedDB but won't be touched.
    // We don't delete them — that would risk a destructive upgrade,
    // and they cost nothing sitting there.
    this.version(2).stores({
      settings: '&key',
    });
  }
}

export const db = new LocalDB();

export async function initDb(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
}