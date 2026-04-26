// Spec §5.3 — recipe detail view, edit/delete, "✨ Standardise Recipe" button.

import { useParams, Link } from 'react-router-dom';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="text-3xl font-display">Recipe Detail</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Recipe ID: <code className="font-mono">{id}</code>
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
        <strong className="font-medium text-stone-700 dark:text-stone-300">
          Next:
        </strong>{' '}
        Implements §5.3 — title hero, ingredients, steps, edit + delete + standardise.
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <Link
          to={`/recipe/${id}/edit`}
          className="text-sage-700 dark:text-sage-300 underline"
        >
          → Edit
        </Link>
        <Link
          to={`/recipe/${id}/standardise`}
          className="text-sage-700 dark:text-sage-300 underline"
        >
          → Standardise
        </Link>
      </div>
    </div>
  );
}
