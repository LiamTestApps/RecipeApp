import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecipeWithRelations, deleteRecipe } from '../db';
import { heroColors } from '../lib/colors';
import { formatTime, cx } from '../lib/utils';
import StarRating from '../components/StarRating';
import ConfirmDialog from '../components/ConfirmDialog';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = id ? Number.parseInt(id, 10) : NaN;

  const recipe = useLiveQuery(
    () => (Number.isFinite(recipeId) ? getRecipeWithRelations(recipeId) : undefined),
    [recipeId],
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  // Track theme for the hero (same pattern as HomePage).
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

  if (!Number.isFinite(recipeId)) {
    return <CenteredMessage>Invalid recipe URL.</CenteredMessage>;
  }
  if (recipe === undefined) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (recipe === null) {
    return <CenteredMessage>Recipe not found.</CenteredMessage>;
  }

  const colors = heroColors(recipe.title, isDark);
  const handleDelete = async () => {
    await deleteRecipe(recipeId);
    navigate('/', { replace: true });
  };

  return (
    <article className="mx-auto max-w-md pb-8">
      {/* Hero */}
      <header
        className="relative px-5 pt-10 pb-6"
        style={{ background: colors.background, color: colors.foreground }}
      >
        <Link
          to="/"
          aria-label="Back to recipes"
          className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center bg-stone-50/30 hover:bg-stone-50/50 backdrop-blur"
          style={{ color: colors.foreground }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4l-5 5 5 5" />
          </svg>
        </Link>

        {recipe.isStandardised && (
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium mt-4"
            style={{
              background: colors.foreground,
              color: colors.background,
              opacity: 0.9,
            }}
            title="This recipe has been standardised"
          >
            ✨ Standardised
          </span>
        )}

        <h1 className="font-display text-4xl leading-tight mt-3">
          {recipe.title}
        </h1>

        <div
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          style={{ color: colors.foreground, opacity: 0.85 }}
        >
          {recipe.prepTimeMinutes !== null && (
            <Meta label="Prep">{formatTime(recipe.prepTimeMinutes)}</Meta>
          )}
          {recipe.cookTimeMinutes !== null && (
            <Meta label="Cook">{formatTime(recipe.cookTimeMinutes)}</Meta>
          )}
          {recipe.rating !== null && (
            <StarRating value={recipe.rating} size="sm" />
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {recipe.tags.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium"
                style={{
                  background: 'rgba(0,0,0,0.08)',
                  color: colors.foreground,
                }}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs underline underline-offset-2"
            style={{ color: colors.foreground, opacity: 0.85 }}
          >
            Source
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 1h6v6" />
              <path d="M10 1L4 7" />
              <path d="M9 7v3H1V2h3" />
            </svg>
          </a>
        )}
      </header>

      {/* Ingredients */}
      <section className="px-5 mt-6">
        <h2 className="font-display text-xl">Ingredients</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
            No ingredients listed.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex gap-2 text-sm">
                <span className="text-stone-400 dark:text-stone-500 select-none mt-1">
                  •
                </span>
                <span className="flex-1">
                  {ing.quantity && (
                    <span className="font-medium tabular-nums">
                      {ing.quantity}
                      {ing.unit ? ' ' + ing.unit : ''}{' '}
                    </span>
                  )}
                  {!ing.quantity && ing.unit && (
                    <span className="font-medium">{ing.unit} </span>
                  )}
                  <span>{ing.name}</span>
                  {ing.notes && (
                    <span className="text-stone-500 dark:text-stone-400">
                      {' '}— {ing.notes}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Steps */}
      <section className="px-5 mt-8">
        <h2 className="font-display text-xl">Method</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
            No steps recorded.
          </p>
        ) : (
          <ol className="mt-3 space-y-4">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-700 dark:bg-sage-500 text-stone-50 dark:text-stone-950 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {step.stepNumber}
                </span>
                <p className="flex-1 text-sm leading-relaxed whitespace-pre-line">
                  {step.instruction}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Notes (collapsible) */}
      {recipe.notes && (
        <section className="px-5 mt-8">
          <button
            type="button"
            onClick={() => setNotesOpen(!notesOpen)}
            className="flex items-center gap-2 w-full text-left"
            aria-expanded={notesOpen}
          >
            <h2 className="font-display text-xl">Notes</h2>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={cx(
                'transition-transform text-stone-400',
                notesOpen ? 'rotate-180' : '',
              )}
              aria-hidden="true"
            >
              <path d="M3 5l4 4 4-4" />
            </svg>
          </button>
          {notesOpen && (
            <p className="mt-2 text-sm text-stone-700 dark:text-stone-300 whitespace-pre-line">
              {recipe.notes}
            </p>
          )}
        </section>
      )}

      {/* Actions */}
      <section className="px-5 mt-10 flex flex-col gap-2">
        <Link
          to={`/recipe/${recipe.id}/standardise`}
          className="w-full px-4 py-3 rounded-full text-center font-medium bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200 border border-sage-200 dark:border-sage-800"
        >
          ✨ Standardise Recipe
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/recipe/${recipe.id}/edit`}
            className="flex-1 px-4 py-3 rounded-full text-center font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex-1 px-4 py-3 rounded-full font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this recipe?"
        message={`"${recipe.title}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wider opacity-75">
        {label}
      </span>
      <span className="font-medium">{children}</span>
    </span>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-16 text-center text-sm text-stone-500 dark:text-stone-400">
      {children}
    </div>
  );
}
