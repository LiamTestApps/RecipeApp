import { cx } from '../lib/utils';
import { capitalise } from '../lib/utils';

interface Props {
  label: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Small uppercase letterspaced chip rather than a colourful bubble — fits
 * the editorial aesthetic and stays legible in both light and dark themes.
 */
export default function TagChip({
  label,
  onRemove,
  size = 'md',
  className,
}: Props) {
  const dismissible = onRemove !== undefined;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full',
        'border border-stone-300 dark:border-stone-700',
        'bg-stone-100/60 dark:bg-stone-800/60',
        'text-stone-700 dark:text-stone-300',
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px] tracking-wider uppercase'
          : 'px-2.5 py-1 text-xs tracking-wide',
        className,
      )}
    >
      {capitalise(label)}
      {dismissible && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="-mr-0.5 rounded-full p-0.5 hover:bg-stone-200 dark:hover:bg-stone-700"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}
