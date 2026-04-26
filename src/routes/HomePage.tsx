// Spec §5.2 — recipe list, search, filter panel, grid/list toggle.
// Implementation lands in the next turn.

export default function HomePage() {
  return (
    <PagePlaceholder
      title="Recipes"
      description="Your recipe list will live here."
      next="Implements §5.2: search bar, filter panel, recipe cards, grid/list toggle, empty state."
    />
  );
}

function PagePlaceholder({
  title,
  description,
  next,
}: {
  title: string;
  description: string;
  next: string;
}) {
  return (
    <div className="px-5 pt-12 pb-8">
      <h1 className="text-3xl font-display">{title}</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
        <strong className="font-medium text-stone-700 dark:text-stone-300">
          Next:
        </strong>{' '}
        {next}
      </div>
    </div>
  );
}
