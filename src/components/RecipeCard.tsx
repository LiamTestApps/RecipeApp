import { Link } from 'react-router-dom';
import type { Recipe, Tag } from '../types';
import { heroColors } from '../lib/colors';
import { formatTime, cx } from '../lib/utils';
import StarRating from './StarRating';
import TagChip from './TagChip';

interface Props {
  recipe: Recipe & { tags: Tag[] };
  view: 'grid' | 'list';
  isDark: boolean;
}

/**
 * Recipe card. The hero region uses a title-derived colour and the title
 * sits inside it — like the spine of a coloured cookbook. List view is a
 * compact horizontal variant of the same idea.
 *
 * The whole card is a Link so the entire surface is tappable
 * (good for thumb-targeted interaction on mobile).
 */
export default function RecipeCard({ recipe, view, isDark }: Props) {
  const colors = heroColors(recipe.title, isDark);
  const totalTime =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const hasTime = recipe.prepTimeMinutes !== null || recipe.cookTimeMinutes !== null;

  if (view === 'list') {
    return (
      <Link
        to={`/recipe/${recipe.id}`}
        className="group flex gap-3 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 transition-colors hover:border-stone-300 dark:hover:border-stone-700"
      >
        <div
          className="w-20 flex-shrink-0 flex items-center justify-center"
          style={{ background: colors.background }}
        >
          <span
            className="font-display text-2xl"
            style={{ color: colors.foreground }}
            aria-hidden="true"
          >
            {recipe.title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0 py-2.5 pr-3">
          <h3 className="font-display text-base leading-tight truncate">
            {recipe.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            {hasTime && <span>{formatTime(totalTime || null)}</span>}
            {hasTime && recipe.rating !== null && <span>·</span>}
            {recipe.rating !== null && (
              <StarRating value={recipe.rating} size="sm" />
            )}
          </div>
          {recipe.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((t) => (
                <TagChip key={t.id} label={t.name} size="sm" />
              ))}
              {recipe.tags.length > 3 && (
                <span className="text-[10px] text-stone-400 self-center">
                  +{recipe.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className={cx(
        'group block rounded-2xl overflow-hidden',
        'bg-stone-100 dark:bg-stone-900',
        'border border-stone-200 dark:border-stone-800',
        'transition-all hover:border-stone-300 dark:hover:border-stone-700',
        'active:scale-[0.98] transform-gpu',
      )}
    >
      <div
        className="aspect-[5/3] flex items-end p-3 relative"
        style={{ background: colors.background }}
      >
        {recipe.isStandardised && (
          <span
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-medium"
            style={{
              background: colors.foreground,
              color: colors.background,
              opacity: 0.85,
            }}
            title="This recipe has been standardised"
          >
            ✨
          </span>
        )}
        <h3
          className="font-display text-lg leading-tight line-clamp-2"
          style={{ color: colors.foreground }}
        >
          {recipe.title}
        </h3>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
          <span>{hasTime ? formatTime(totalTime || null) : '\u00a0'}</span>
          {recipe.rating !== null && (
            <StarRating value={recipe.rating} size="sm" />
          )}
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.slice(0, 2).map((t) => (
              <TagChip key={t.id} label={t.name} size="sm" />
            ))}
            {recipe.tags.length > 2 && (
              <span className="text-[10px] text-stone-400 self-center">
                +{recipe.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
