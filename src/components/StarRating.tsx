import { cx } from '../lib/utils';

interface Props {
  /** 1–5 or null for unrated. */
  value: number | null;
  /** When provided, the widget becomes interactive. */
  onChange?: (value: number | null) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Spec §5.4: tap a star to set rating, tap the *same* star again to clear.
 * Read-only mode (no onChange) used on cards and detail page.
 */
export default function StarRating({
  value,
  onChange,
  size = 'md',
  className,
}: Props) {
  const interactive = onChange !== undefined;
  const px = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

  const handleClick = (n: number) => {
    if (!onChange) return;
    onChange(value === n ? null : n);
  };

  return (
    <div
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={value === null ? 'No rating' : `Rated ${value} out of 5`}
      className={cx('inline-flex items-center gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== null && n <= value;
        const Tag = interactive ? 'button' : 'span';
        return (
          <Tag
            key={n}
            {...(interactive
              ? {
                  type: 'button' as const,
                  onClick: () => handleClick(n),
                  'aria-label': `${n} star${n === 1 ? '' : 's'}`,
                  'aria-pressed': filled,
                  className:
                    'p-1 -m-1 rounded transition-transform active:scale-90',
                }
              : { 'aria-hidden': true })}
          >
            <Star size={px} filled={filled} />
          </Tag>
        );
      })}
    </div>
  );
}

function Star({ size, filled }: { size: number; filled: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      className={
        filled
          ? 'text-sage-700 dark:text-sage-300'
          : 'text-stone-300 dark:text-stone-600'
      }
    >
      <path d="M12 2.5l2.9 6.4 6.6.6-5 4.6 1.5 6.4-6-3.5-6 3.5 1.5-6.4-5-4.6 6.6-.6z" />
    </svg>
  );
}
