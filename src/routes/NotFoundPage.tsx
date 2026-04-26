import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="px-5 pt-16 pb-8 text-center">
      <h1 className="text-4xl font-display">Lost in the pantry</h1>
      <p className="mt-3 text-stone-600 dark:text-stone-400">
        That page doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-sage-700 px-5 py-2 text-stone-50 dark:bg-sage-500 dark:text-stone-950"
      >
        Back to recipes
      </Link>
    </div>
  );
}
