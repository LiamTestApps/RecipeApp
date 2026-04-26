import { cx } from '../lib/utils';

interface Props {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
}

/**
 * Sticky top bar for the Add/Edit Recipe page.
 * Standard mobile pattern: dismiss-on-left, primary action on right.
 */
export default function EditHeader({
  title,
  onCancel,
  onSave,
  saveDisabled = false,
  saveLabel = 'Save',
}: Props) {
  return (
    <header
      className={cx(
        'sticky top-0 z-20',
        'bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur',
        'border-b border-stone-200 dark:border-stone-800',
      )}
    >
      <div className="mx-auto max-w-md flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-full text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 h-tap"
        >
          Cancel
        </button>
        <h1 className="font-display text-base">{title}</h1>
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={cx(
            'px-4 py-2 rounded-full text-sm font-medium h-tap',
            saveDisabled
              ? 'text-stone-400 dark:text-stone-600 cursor-not-allowed'
              : 'bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950',
          )}
        >
          {saveLabel}
        </button>
      </div>
    </header>
  );
}
