import { useEffect, useMemo, useState } from 'react';
import { listRecipesForHome } from '../db';
import RecipeCard from '../components/RecipeCard';
import SearchBar from '../components/SearchBar';
import ViewToggle, { type ViewMode } from '../components/ViewToggle';
import EmptyState from '../components/EmptyState';
import { useDebounced } from '../hooks/useDebounced';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { normalise } from '../lib/utils';
import FilterPanel, { type TagMode } from '../components/FilterPanel';
import type { Tag } from '../types';

/**
 * Recipe list (spec §5.2). The full filter panel (tags, ingredient contains,
 * pantry mode, sort) ships in the next pass — this turn covers the search
 * bar + view toggle + cards.
 */
export default function HomePage() {
  // useLiveQuery re-runs when any of the recipe/ingredient/tag tables change,
  // so adding or editing a recipe updates the list with no manual refetch.
  const [recipes, setRecipes] = useState<
    Awaited<ReturnType<typeof listRecipesForHome>> | undefined
  >(undefined);
  const isLoading = recipes === undefined;

  useEffect(() => {
    let cancelled = false;
    listRecipesForHome()
      .then((rows) => {
        if (!cancelled) setRecipes(rows);
      })
      .catch((err) => {
        console.error('Failed to load recipes:', err);
        if (!cancelled) setRecipes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput, 150);

  const [view, setView] = useLocalStorage<ViewMode>('recipe-book.view', 'grid');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagMode, setTagMode] = useState<TagMode>('and');

  // Track the system colour scheme so RecipeCard can pick the right hero
  // foreground/background. Updates if the user changes their OS setting
  // mid-session, and respects the manual `dark` class override.
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // All distinct tags currently in use, for the filter panel. We derive
  // these from the loaded recipes rather than hitting the tags table —
  // saves a query and ensures the list only shows tags that actually
  // appear on recipes (no orphan tags).
  const allTags = useMemo<Tag[]>(() => {
    if (!recipes) return [];
    const byId = new Map<number, Tag>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        if (tag.id !== undefined && !byId.has(tag.id)) {
          byId.set(tag.id, tag);
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [recipes]);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    const q = normalise(debouncedSearch);

    return recipes.filter((r) => {
      // Title match (existing behaviour)
      if (q && !normalise(r.title).includes(q)) return false;

      // Tag filter
      if (selectedTagIds.length > 0) {
        const recipeTagIds = r.tags
          .map((t) => t.id)
          .filter((id): id is number => id !== undefined);
        if (tagMode === 'and') {
          // Every selected tag must be on the recipe
          if (!selectedTagIds.every((id) => recipeTagIds.includes(id))) {
            return false;
          }
        } else {
          // At least one selected tag must be on the recipe
          if (!selectedTagIds.some((id) => recipeTagIds.includes(id))) {
            return false;
          }
        }
      }

      return true;
    });
  }, [recipes, debouncedSearch, selectedTagIds, tagMode]);

  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-10 pb-4">
        <h1 className="font-display text-3xl">Recipes</h1>
        {!isLoading && (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {recipes!.length === 0
              ? 'Your collection is empty.'
              : `${recipes!.length} recipe${recipes!.length === 1 ? '' : 's'} in your book`}
          </p>
        )}
      </header>

      {!isLoading && recipes!.length > 0 && (
        <div className="px-5 pb-3 flex items-center gap-2">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label={
              selectedTagIds.length > 0
                ? `Filtered by ${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'}`
                : 'Filter by tags'
            }
            className={`relative h-9 w-9 flex items-center justify-center rounded-full border ${
              selectedTagIds.length > 0
                ? 'bg-sage-100 dark:bg-sage-900/40 border-sage-300 dark:border-sage-700 text-sage-700 dark:text-sage-300'
                : 'border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 4h12M4 8h8M6 12h4" />
            </svg>
            {selectedTagIds.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sage-700 dark:bg-sage-500 text-stone-50 dark:text-stone-950 text-[10px] font-semibold flex items-center justify-center">
                {selectedTagIds.length}
              </span>
            )}
          </button>
          <ViewToggle value={view} onChange={setView} />
        </div>
      )}

      <div className="px-5 pb-8">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-stone-500 dark:text-stone-400">
            Loading…
          </div>
        ) : recipes!.length === 0 ? (
          <EmptyState variant="no-recipes" />
        ) : filtered.length === 0 ? (
          <EmptyState variant="no-results" />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} view="grid" isDark={isDark} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} view="list" isDark={isDark} />
            ))}
          </div>
        )}
      </div>
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onSelectedTagIdsChange={setSelectedTagIds}
        mode={tagMode}
        onModeChange={setTagMode}
      />
    </div>
  );
}