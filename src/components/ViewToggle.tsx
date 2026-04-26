import { cx } from '../lib/utils';

export type ViewMode = 'grid' | 'list';

interface Props {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export default function ViewToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className={cx(
        'inline-flex rounded-full border border-stone-200 dark:border-stone-800',
        'bg-stone-100 dark:bg-stone-900 p-0.5',
        className,
      )}
    >
      <Button
        active={value === 'grid'}
        onClick={() => onChange('grid')}
        label="Grid view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      </Button>
      <Button
        active={value === 'list'}
        onClick={() => onChange('list')}
        label="List view"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="2" y="3" width="12" height="2" rx="1" />
          <rect x="2" y="7" width="12" height="2" rx="1" />
          <rect x="2" y="11" width="12" height="2" rx="1" />
        </svg>
      </Button>
    </div>
  );
}

function Button({
  children,
  active,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
        active
          ? 'bg-stone-50 dark:bg-stone-700 text-sage-700 dark:text-sage-300 shadow-sm'
          : 'text-stone-500 dark:text-stone-400',
      )}
    >
      {children}
    </button>
  );
}
