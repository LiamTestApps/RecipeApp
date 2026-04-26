import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listRecipesForHome } from '../db';
import RecipeCard from '../components/RecipeCard';
import SearchBar from '../components/SearchBar';
import ViewToggle, { type ViewMode } from '../components/ViewToggle';
import EmptyState from '../components/EmptyState';
import { useDebounced } from '../hooks/useDebounced';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { normalise } from '../lib/utils';

/**
 * Recipe list (spec §5.2). The full filter panel (tags, ingredient contains,
 * pantry mode, sort) ships in the next pass — this turn covers the search
 * bar + view toggle + cards.
 */
export default function HomePage() {
  // useLiveQuery re-runs when any of the recipe/ingredient/tag tables change,
  // so adding or editing a recipe updates the list with no manual refetch.
  const recipes = useLiveQuery(() => listRecipesForHome(), []);
  const isLoading = recipes === undefined;

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounced(searchInput, 150);

  const [view, setView] = useLocalStorage<ViewMode>('recipe-book.view', 'grid');

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

  const filtered = useMemo(() => {
    if (!recipes) return [];
    const q = normalise(debouncedSearch);
    if (!q) return recipes;
    return recipes.filter((r) => normalise(r.title).includes(q));
  }, [recipes, debouncedSearch]);

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
    </div>
  );
}
