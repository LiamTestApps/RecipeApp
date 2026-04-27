import { useEffect, useState } from 'react';
import type { Tag } from '../types';
import { capitalise, cx } from '../lib/utils';

export type TagMode = 'and' | 'or';

interface Props {
  open: boolean;
  onClose: () => void;
  /** All tags in the library, sorted however the caller wants. */
  allTags: Tag[];
  /** Currently selected tag IDs. */
  selectedTagIds: number[];
  onSelectedTagIdsChange: (next: number[]) => void;
  mode: TagMode;
  onModeChange: (next: TagMode) => void;
}

/**
 * Bottom-sheet filter panel for the home screen.
 *
 * UX shape:
 *   - All tags shown as toggleable chips. Tap to add to the filter,
 *     tap again to remove. No pagination — if your library has
 *     hundreds of tags this would need a search box, but the realistic
 *     personal-use ceiling is ~30 and they all fit fine.
 *   - AND/OR pill switch at the top, only visible when 2+ tags
 *     selected (since it's meaningless with 0 or 1).
 *   - "Clear all" link in the top-right when at least one tag is
 *     selected. Skips the per-tag tapping when you want to start fresh.
 *   - Apply doesn't exist as a button: changes are live as you tap.
 *     The "Done" button at the bottom is just a way to dismiss.
 */
export default function FilterPanel({
  open,
  onClose,
  allTags,
  selectedTagIds,
  onSelectedTagIdsChange,
  mode,
  onModeChange,
}: Props) {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Slide-in animation gate (matches the other modals).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    return;
  }, [open]);

  if (!open) return null;

  const toggleTag = (id: number) => {
    if (selectedTagIds.includes(id)) {
      onSelectedTagIdsChange(selectedTagIds.filter((t) => t !== id));
    } else {
      onSelectedTagIdsChange([...selectedTagIds, id]);
    }
  };

  const clearAll = () => onSelectedTagIdsChange([]);

  const showModeSwitch = selectedTagIds.length >= 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-panel-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-stone-950/40 dark:bg-stone-950/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cx(
          'relative w-full max-w-md',
          'bg-stone-50 dark:bg-stone-900',
          'rounded-t-3xl sm:rounded-2xl',
          'flex flex-col max-h-[80vh]',
          'shadow-2xl',
          'transition-transform duration-200',
          mounted ? 'translate-y-0' : 'translate-y-4',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 id="filter-panel-title" className="font-display text-xl">
            Filter by tags
          </h2>
          {selectedTagIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm text-sage-700 dark:text-sage-400 underline underline-offset-2"
            >
              Clear all
            </button>
          )}
        </div>

        {/* AND/OR switch — only visible when meaningful */}
        {showModeSwitch && (
          <div className="px-5 pb-2">
            <div
              role="radiogroup"
              aria-label="Match mode"
              className="inline-flex rounded-full border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 p-0.5 text-xs"
            >
              <ModeButton
                active={mode === 'and'}
                onClick={() => onModeChange('and')}
                label="Match all"
                hint="recipes with every selected tag"
              />
              <ModeButton
                active={mode === 'or'}
                onClick={() => onModeChange('or')}
                label="Match any"
                hint="recipes with any selected tag"
              />
            </div>
          </div>
        )}

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
          {allTags.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-6 text-center">
              No tags yet. Add tags to recipes to filter by them.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 py-2">
              {allTags.map((t) => {
                const id = t.id!;
                const active = selectedTagIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTag(id)}
                    aria-pressed={active}
                    className={cx(
                      'px-3 py-1.5 rounded-full text-sm transition-colors border',
                      active
                        ? 'bg-sage-700 dark:bg-sage-500 text-stone-50 dark:text-stone-950 border-sage-700 dark:border-sage-500'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700',
                    )}
                  >
                    {capitalise(t.name)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-2 pb-6 pb-safe border-t border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded-full font-medium bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${label}: ${hint}`}
      onClick={onClick}
      className={cx(
        'px-3 py-1 rounded-full transition-colors',
        active
          ? 'bg-stone-50 dark:bg-stone-700 text-sage-700 dark:text-sage-300 shadow-sm'
          : 'text-stone-500 dark:text-stone-400',
      )}
    >
      {label}
    </button>
  );
}