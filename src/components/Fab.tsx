import { Link } from 'react-router-dom';

interface FabProps {
  to: string;
  label: string;
}

/**
 * Material-style FAB. Sits above the bottom nav (~80px from bottom)
 * so it doesn't collide with thumb reach for the nav itself.
 */
export default function Fab({ to, label }: FabProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="
        fixed bottom-20 right-4 z-40
        flex h-14 w-14 items-center justify-center
        rounded-full bg-sage-700 text-white shadow-lg
        transition-transform active:scale-95
        hover:bg-sage-600
        dark:bg-sage-500 dark:hover:bg-sage-400 dark:text-stone-950
      "
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Link>
  );
}
