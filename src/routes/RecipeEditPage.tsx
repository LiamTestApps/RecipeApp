// Spec §5.4 — Add/Edit recipe form. The same component handles both
// create and edit modes; the `mode` prop is set in App.tsx routing.

import { useParams } from 'react-router-dom';

interface Props {
  mode: 'create' | 'edit';
}

export default function RecipeEditPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="text-3xl font-display">
        {mode === 'create' ? 'New Recipe' : 'Edit Recipe'}
      </h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Mode: <code className="font-mono">{mode}</code>
        {id ? (
          <>
            {' '}— Recipe ID: <code className="font-mono">{id}</code>
          </>
        ) : null}
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
        <strong className="font-medium text-stone-700 dark:text-stone-300">
          Next:
        </strong>{' '}
        Implements §5.4 — title, times, source URL, rating, tags, ingredient
        editor with drag-reorder, step editor, notes, ✨ Smart Extract modal.
      </div>
    </div>
  );
}
