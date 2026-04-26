// Domain types. These mirror the Dexie schema in src/db/schema.ts
// 1:1, including nullability. The Dexie schema is the source of truth
// for *storage*; these types are what application code passes around.
//
// Spec reference: requirements §3.

/** A recipe row as stored in IndexedDB. `id` is undefined before insert. */
export interface Recipe {
  id?: number;
  title: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  sourceUrl: string | null;
  notes: string | null;
  /** 1–5 inclusive, or null for unrated. */
  rating: number | null;
  createdAt: number;
  updatedAt: number;
  isStandardised: boolean;
}

export interface Ingredient {
  id?: number;
  recipeId: number;
  /** Stored as string to preserve fractions like "1/2", "1-2". */
  quantity: string | null;
  unit: string | null;
  name: string;
  notes: string | null;
  sortOrder: number;
}

export interface Step {
  id?: number;
  recipeId: number;
  /** 1-indexed. */
  stepNumber: number;
  instruction: string;
}

export interface Tag {
  id?: number;
  /** Stored lowercase; display capitalised. */
  name: string;
}

export interface RecipeTag {
  id?: number;
  recipeId: number;
  tagId: number;
}

/** Generic key/value table for things like the Gemini API key, theme override. */
export interface Setting {
  key: string;
  value: string;
}

// ─── Composite shapes used by the UI ────────────────────────────────────────

/** A recipe joined with its ingredients, steps, and tag names — what most pages need. */
export interface RecipeWithRelations extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
  tags: Tag[];
}

/** Editor-side draft. `id` may be missing (new) and rows have no recipeId yet. */
export interface RecipeDraft {
  id?: number;
  title: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  sourceUrl: string | null;
  notes: string | null;
  rating: number | null;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  /** Tag names, lowercase. Tags are looked up / created on save. */
  tagNames: string[];
}

export type IngredientDraft = Omit<Ingredient, 'id' | 'recipeId'>;
export type StepDraft = Omit<Step, 'id' | 'recipeId'>;

// ─── Filter / search shapes ──────────────────────────────────────────────────

export type SortMode =
  | 'a-z'
  | 'z-a'
  | 'newest'
  | 'highest-rated'
  | 'shortest-cook';

export interface RecipeFilters {
  /** Title contains (case-insensitive). */
  search: string;
  /** Tag IDs. */
  tagIds: number[];
  tagMode: 'and' | 'or';
  /** Spec 7.2 — partial case-insensitive ingredient name match. */
  ingredientContains: string;
  /** Spec 7.3 — pantry mode list (mutually exclusive with ingredientContains). */
  pantry: string[];
  pantryMode: boolean;
  sort: SortMode;
}

export const DEFAULT_FILTERS: RecipeFilters = {
  search: '',
  tagIds: [],
  tagMode: 'and',
  ingredientContains: '',
  pantry: [],
  pantryMode: false,
  sort: 'newest',
};

// ─── Import / export ─────────────────────────────────────────────────────────

/** Shape of the JSON backup file. Spec §9. */
export interface BackupFile {
  /** Schema version this backup was produced with. */
  version: number;
  exportedAt: number;
  recipes: Array<
    Omit<Recipe, 'id'> & {
      ingredients: Omit<Ingredient, 'id' | 'recipeId'>[];
      steps: Omit<Step, 'id' | 'recipeId'>[];
      tagNames: string[];
    }
  >;
}
