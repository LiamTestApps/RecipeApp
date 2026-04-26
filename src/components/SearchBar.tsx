import { cx } from '../lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search recipes',
  className,
}: Props) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-full',
        'bg-stone-100 dark:bg-stone-900',
        'border border-stone-200 dark:border-stone-800',
        'px-4 py-2.5',
        'focus-within:border-sage-500 dark:focus-within:border-sage-400',
        className,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-stone-400 dark:text-stone-500 flex-shrink-0"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5 L21 21" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-400 dark:placeholder:text-stone-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
