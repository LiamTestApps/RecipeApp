import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAllTags } from '../db';
import TagChip from './TagChip';
import { cx, normalise } from '../lib/utils';

interface Props {
  values: string[]; // lowercase tag names
  onChange: (values: string[]) => void;
}

/**
 * Spec §5.4: type-ahead chip input. Shows suggestions from existing tags;
 * Enter creates a new one (or selects the highlighted suggestion).
 */
export default function TagInput({ values, onChange }: Props) {
  const allTags = useLiveQuery(() => listAllTags(), []) ?? [];
  const [draft, setDraft] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestion list when clicking outside.
  useEffect(() => {
    if (!showSuggestions) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showSuggestions]);

  const lowerDraft = normalise(draft);

  const suggestions = allTags
    .filter(
      (t) =>
        lowerDraft.length > 0 &&
        t.name.includes(lowerDraft) &&
        !values.includes(t.name),
    )
    .slice(0, 6);

  const exactExists =
    lowerDraft.length > 0 && allTags.some((t) => t.name === lowerDraft);

  const addTag = (name: string) => {
    const n = normalise(name);
    if (!n) return;
    if (values.includes(n)) {
      setDraft('');
      return;
    }
    onChange([...values, n]);
    setDraft('');
    inputRef.current?.focus();
  };

  const removeTag = (name: string) => {
    onChange(values.filter((v) => v !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && draft.trim()) {
      e.preventDefault();
      addTag(draft);
      return;
    }
    if (e.key === ',') {
      e.preventDefault();
      addTag(draft);
      return;
    }
    // Backspace on empty input removes last tag.
    if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      e.preventDefault();
      removeTag(values[values.length - 1]!);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cx(
          'flex flex-wrap items-center gap-1.5 rounded-xl',
          'border border-stone-200 dark:border-stone-800',
          'bg-stone-50 dark:bg-stone-900',
          'px-2 py-2',
          'focus-within:border-sage-500 dark:focus-within:border-sage-400',
        )}
      >
        {values.map((name) => (
          <TagChip key={name} label={name} onRemove={() => removeTag(name)} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? 'Add tags…' : ''}
          aria-label="Add tag"
          className="flex-1 min-w-[6rem] bg-transparent outline-none text-sm py-0.5 placeholder:text-stone-400 dark:placeholder:text-stone-500"
        />
      </div>

      {showSuggestions && (suggestions.length > 0 || (lowerDraft && !exactExists)) && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-lg"
        >
          {suggestions.map((t) => (
            <li
              key={t.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                // mousedown so it fires before the input blurs
                e.preventDefault();
                addTag(t.name);
              }}
              className="px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <span className="capitalize">{t.name}</span>
            </li>
          ))}
          {lowerDraft && !exactExists && !suggestions.some((s) => s.name === lowerDraft) && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(lowerDraft);
              }}
              className="px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer text-sage-700 dark:text-sage-400"
            >
              Create &ldquo;<span className="capitalize">{lowerDraft}</span>&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
