import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirm dialog. Backdrop click or Esc cancels. The confirm button
 * gets a destructive style when `destructive` is true.
 *
 * Slide-up animation matches the spec's "drawers slide up from bottom"
 * Android pattern (§10.2).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-stone-950/40 dark:bg-stone-950/70 animate-in fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="
          relative w-full max-w-md
          bg-stone-50 dark:bg-stone-900
          rounded-t-3xl sm:rounded-2xl
          p-6 pb-safe
          shadow-2xl
          animate-in slide-in-from-bottom
        "
      >
        <h2
          id="confirm-dialog-title"
          className="font-display text-xl"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 whitespace-pre-line">
          {message}
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'px-4 py-2 rounded-full text-sm font-medium bg-red-600 text-stone-50 hover:bg-red-700'
                : 'px-4 py-2 rounded-full text-sm font-medium bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
