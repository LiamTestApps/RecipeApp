// Dexie schema for the recipe book.
// Spec reference: requirements §3.
//
// MIGRATION RULES (Spec §3.6 + §12):
//   - Increment the version number for ANY schema change.
//   - Provide an `.upgrade()` callback for any version that adds/renames fields.
//   - Destructive upgrades are forbidden — existing user data must survive.

import Dexie, { type Table } from 'dexie';
import type {
  Recipe,
  Ingredient,
  Step,
  Tag,
  RecipeTag,
  Setting,
} from '../types';

/** Single source of truth for the current schema version. */
export const DB_VERSION = 1;

/** Settings table keys we use. Centralised so we don't typo them. */
export const SETTING_KEYS = {
  GEMINI_API_KEY: 'geminiApiKey',
  THEME_OVERRIDE: 'themeOverride', // 'light' | 'dark' | unset (= follow system)
} as const;

class RecipeDB extends Dexie {
  recipes!: Table<Recipe, number>;
  ingredients!: Table<Ingredient, number>;
  steps!: Table<Step, number>;
  tags!: Table<Tag, number>;
  recipeTags!: Table<RecipeTag, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('RecipeBookDB');

    // ── Version 1 ────────────────────────────────────────────────────────
    // Indexes per spec §3:
    //   recipes:     title, rating, createdAt
    //   ingredients: recipeId, name
    //   steps:       recipeId
    //   tags:        name (unique)
    //   recipeTags:  [recipeId+tagId] compound unique, plus singletons
    //                so we can query "all tags for a recipe" and vice versa.
    //   settings:    key (unique primary)
    //
    // The `&` prefix means "unique"; `++id` means auto-increment primary key.
    this.version(1).stores({
      recipes: '++id, title, rating, createdAt',
      ingredients: '++id, recipeId, name',
      steps: '++id, recipeId',
      tags: '++id, &name',
      recipeTags: '++id, &[recipeId+tagId], recipeId, tagId',
      settings: '&key',
    });

    // Future versions go here:
    //
    // this.version(2).stores({ recipes: '++id, title, rating, createdAt, photoBlobId' })
    //   .upgrade(tx => tx.table('recipes').toCollection().modify(r => { r.photoBlobId = null; }));
  }
}

/** The single database instance used throughout the app. */
export const db = new RecipeDB();

/** Open the DB explicitly so we can surface failures early. Call once at app start. */
export async function initDb(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
}
