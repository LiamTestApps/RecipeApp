import { useEffect, useState } from 'react';
import {
  extractFromUrl,
  messageForError,
  type ExtractedRecipe,
} from '../lib/gemini';
import { cx } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Called when extraction succeeds. The URL is forwarded so the form can
   * auto-populate the Source URL field.
   */
  onApply: (recipe: ExtractedRecipe, sourceUrl: string) => void;
}

/**
 * Modal that takes a recipe URL and parses it via Gemini's URL Context tool.
 * Same UX shape as SmartExtractModal but with a single-line URL input
 * instead of a multi-line text area, and a longer "this might take a bit"
 * loading state because URL fetches involve a server round trip plus a
 * page render before the model even starts thinking.
 */
export default function FromUrlModal({ open, onClose, onApply }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Paste a URL first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await extractFromUrl(url);
      // Empty title means the URL didn't actually have a recipe — see
      // the prompt in extractFromUrl which instructs the model to
      // return an empty shell in that case.
      if (!result.title || result.ingredients.length === 0) {
        setError("Couldn't find a recipe on that page. Try a direct recipe link.");
        setBusy(false);
        return;
      }
      onApply(result, url.trim());
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
      aria-labelledby="from-url-title"
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
          shadow-2xl
        "
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 id="from-url-title" className="font-display text-xl">
            🔗 From URL
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
            Paste the URL of a recipe page. The AI will fetch it and extract
            the title, times, ingredients, and steps.
          </p>
        </div>

        <div className="px-5 py-2 space-y-2">
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            placeholder="https://…"
            aria-label="Recipe URL"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) {
                e.preventDefault();
                handleExtract();
              }
            }}
            className={cx(
              'w-full bg-stone-100 dark:bg-stone-800',
              'border border-stone-200 dark:border-stone-700',
              'rounded-xl px-3 py-2.5 text-sm',
              'outline-none focus:border-sage-500 dark:focus:border-sage-400',
              'placeholder:text-stone-400 dark:placeholder:text-stone-500',
              'disabled:opacity-60',
            )}
          />
          {error && (
            <p
              role="alert"
              className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3"
            >
              {error}
            </p>
          )}
          {busy && (
            <p className="text-sm text-stone-600 dark:text-stone-400 flex items-center gap-2">
              <Spinner /> Fetching the page and reading the recipe…
            </p>
          )}
        </div>

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
            disabled={busy || url.trim() === ''}
            className={cx(
              'px-4 py-2 rounded-full text-sm font-medium',
              busy || url.trim() === ''
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
                : 'bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950',
            )}
          >
            {busy ? 'Fetching…' : 'Fetch recipe'}
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
