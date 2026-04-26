// Spec §6B — Recipe Standardisation flow.
// This is its own page (not a modal) so the side-by-side preview gets
// proper screen real estate on tablet/desktop.

import { useParams } from 'react-router-dom';

export default function StandardisePreviewPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="text-3xl font-display">Standardise Recipe</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Recipe ID: <code className="font-mono">{id}</code>
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
        <strong className="font-medium text-stone-700 dark:text-stone-300">
          Next:
        </strong>{' '}
        Implements §6B.2/6B.5 — confirm dialog, loading state, side-by-side
        Original/Standardised preview, Apply / Discard, JSON parse error handling.
      </div>
    </div>
  );
}
