import { Link } from 'react-router-dom';
import { cx } from '../lib/utils';

interface Props {
  variant: 'no-recipes' | 'no-results';
  className?: string;
}

export default function EmptyState({ variant, className }: Props) {
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center',
        'px-8 py-16',
        className,
      )}
    >
      <Illustration variant={variant} />
      {variant === 'no-recipes' ? (
        <>
          <h2 className="mt-6 font-display text-2xl">A blank cookbook</h2>
          <p className="mt-2 max-w-xs text-sm text-stone-600 dark:text-stone-400">
            Add your first recipe to start building your collection.
          </p>
          <Link
            to="/recipe/new"
            className="mt-6 rounded-full bg-sage-700 px-5 py-2 text-stone-50 dark:bg-sage-500 dark:text-stone-950"
          >
            Add a recipe
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-6 font-display text-2xl">Nothing matches</h2>
          <p className="mt-2 max-w-xs text-sm text-stone-600 dark:text-stone-400">
            Try a different search or clear the filters.
          </p>
        </>
      )}
    </div>
  );
}

/** Hand-drawn-feel SVG illustration. Sage on stone. */
function Illustration({ variant }: { variant: Props['variant'] }) {
  if (variant === 'no-recipes') {
    return (
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-sage-600 dark:text-sage-400"
        aria-hidden="true"
      >
        {/* Open book */}
        <path d="M20 30 L60 26 L60 96 L20 100 Z" />
        <path d="M100 30 L60 26 L60 96 L100 100 Z" />
        <path d="M28 42 L52 39" opacity="0.5" />
        <path d="M28 52 L52 49" opacity="0.5" />
        <path d="M28 62 L48 59" opacity="0.5" />
        <path d="M68 39 L92 42" opacity="0.5" />
        <path d="M68 49 L92 52" opacity="0.5" />
        <path d="M68 59 L88 62" opacity="0.5" />
        {/* Sprig of herbs above */}
        <path d="M60 26 C 60 18, 64 12, 70 10" />
        <path d="M64 18 C 68 16, 72 18, 73 22" />
        <path d="M62 22 C 58 20, 54 22, 53 26" />
      </svg>
    );
  }
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-sage-600 dark:text-sage-400"
      aria-hidden="true"
    >
      <circle cx="52" cy="52" r="28" />
      <path d="M73 73 L94 94" />
      <path d="M40 52 L64 52" opacity="0.4" />
    </svg>
  );
}
