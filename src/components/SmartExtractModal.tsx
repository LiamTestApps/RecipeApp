import { useEffect, useState } from 'react';
import {
  smartExtract,
  messageForError,
  type ExtractedRecipe,
} from '../lib/gemini';
import { cx } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Called with the parsed recipe when the user confirms. The parent
   * decides what to do with it (typically: replace the form draft).
   */
  onApply: (recipe: ExtractedRecipe) => void;
}

/**
 * Modal that takes pasted recipe text and parses it via Gemini.
 *
 * UX choice (per agreed-with-user spec): on success we apply the
 * extracted result directly to the form. No preview screen.
 */
export default function SmartExtractModal({ open, onClose, onApply }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const handleExtract = async () => {
    if (text.trim().length < 10) {
      setError('Paste a bit more text first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await smartExtract(text);
      onApply(result);
    } catch (err) {
      setError(messageForError(err));
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-extract-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-stone-950/40 dark:bg-stone-950/70"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        className="
          relative w-full max-w-md
          bg-stone-50 dark:bg-stone-900
          rounded-t-3xl sm:rounded-2xl
          flex flex-col
          max-h-[90vh]
          shadow-2xl
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 id="smart-extract-title" className="font-display text-xl">
            ✨ Smart Extract
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            disabled={busy}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-2">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Paste a recipe in any format. The AI will extract the title, times,
            ingredients, and steps.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={10}
            placeholder="Paste recipe text here…"
            aria-label="Recipe text"
            className={cx(
              'w-full bg-stone-100 dark:bg-stone-800',
              'border border-stone-200 dark:border-stone-700',
              'rounded-xl px-3 py-2.5 text-sm',
              'outline-none focus:border-sage-500 dark:focus:border-sage-400',
              'placeholder:text-stone-400 dark:placeholder:text-stone-500',
              'resize-y min-h-[12rem]',
              'disabled:opacity-60',
            )}
          />
          {error && (
            <p
              role="alert"
              className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3"
            >
              {error}
            </p>
          )}
          {busy && (
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 flex items-center gap-2">
              <Spinner /> Reading the recipe…
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 pt-2 pb-6 pb-safe border-t border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={busy || text.trim().length === 0}
            className={cx(
              'px-4 py-2 rounded-full text-sm font-medium',
              busy || text.trim().length === 0
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                : 'bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950',
            )}
          >
            {busy ? 'Extracting…' : 'Extract'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M7 1a6 6 0 1 1-6 6" />
    </svg>
  );
}
