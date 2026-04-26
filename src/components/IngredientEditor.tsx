import { useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { IngredientDraft } from '../types';
import { cx } from '../lib/utils';

interface Props {
  ingredients: IngredientDraft[];
  onChange: (ingredients: IngredientDraft[]) => void;
  /** Called when the Smart Extract button is clicked. Parent owns the modal. */
  onSmartExtractClick: () => void;
}

/**
 * Ingredient editor (spec §5.4.1).
 *
 * IMPORTANT: each row needs a *stable* React key that is unrelated to the
 * row's content — otherwise typing in the name field changes the key,
 * unmounts the input, and yanks focus. We mint a numeric uid per row
 * the first time we see it and keep those uids in a parallel array (a
 * ref) aligned by index with `ingredients`. Reorders shuffle the uid
 * array the same way as the data; adds append a fresh uid; removes
 * splice it out.
 */
export default function IngredientEditor({
  ingredients,
  onChange,
  onSmartExtractClick,
}: Props) {
  // The next uid to mint. Counter is per-component-instance and survives
  // for as long as the form is mounted, which is exactly what we need.
  const nextUid = useRef(0);
  // uids[i] is the stable key for ingredients[i]. Length must match.
  const uids = useRef<number[]>([]);

  // Pad the uid array if new rows arrived from the parent (e.g. hydration
  // from the loaded recipe in edit mode, or any external setDraft).
  while (uids.current.length < ingredients.length) {
    uids.current.push(nextUid.current++);
  }
  // Truncate if rows shrank (shouldn't happen via normal flow, but guard).
  if (uids.current.length > ingredients.length) {
    uids.current.length = ingredients.length;
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = uids.current.indexOf(Number(active.id));
    const newIndex = uids.current.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    uids.current = arrayMove(uids.current, oldIndex, newIndex);
    const reordered = arrayMove(ingredients, oldIndex, newIndex);
    onChange(reordered.map((r, i) => ({ ...r, sortOrder: i })));
  };

  const updateRow = (index: number, patch: Partial<IngredientDraft>) => {
    const next = [...ingredients];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const removeRow = (index: number) => {
    uids.current.splice(index, 1);
    onChange(
      ingredients.filter((_, i) => i !== index).map((r, i) => ({ ...r, sortOrder: i })),
    );
  };

  const addRow = () => {
    uids.current.push(nextUid.current++);
    onChange([
      ...ingredients,
      {
        quantity: null,
        unit: null,
        name: '',
        notes: null,
        sortOrder: ingredients.length,
      },
    ]);
  };

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={uids.current}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {ingredients.map((row, index) => (
              <SortableIngredientRow
                key={uids.current[index]}
                uid={uids.current[index]!}
                row={row}
                onUpdate={(patch) => updateRow(index, patch)}
                onRemove={() => removeRow(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {ingredients.length === 0 && (
        <p className="text-sm text-stone-500 dark:text-stone-400 py-3 text-center">
          No ingredients yet.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-2 rounded-full text-sm font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          + Add ingredient
        </button>
        <button
          type="button"
          onClick={onSmartExtractClick}
          className="px-3 py-2 rounded-full text-sm font-medium bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200 border border-sage-200 dark:border-sage-800"
        >
          ✨ Smart Extract
        </button>
      </div>
    </div>
  );
}

function SortableIngredientRow({
  uid,
  row,
  onUpdate,
  onRemove,
}: {
  uid: number;
  row: IngredientDraft;
  onUpdate: (patch: Partial<IngredientDraft>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'rounded-xl border border-stone-200 dark:border-stone-800',
        'bg-stone-50 dark:bg-stone-900',
        'p-2',
        isDragging && 'opacity-60 shadow-lg z-10',
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 cursor-grab active:cursor-grabbing touch-none"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </button>
        <CompactInput
          value={row.quantity ?? ''}
          onChange={(v) => onUpdate({ quantity: v || null })}
          placeholder="Qty"
          width="3.25rem"
          ariaLabel="Quantity"
        />
        <CompactInput
          value={row.unit ?? ''}
          onChange={(v) => onUpdate({ unit: v || null })}
          placeholder="Unit"
          width="3.5rem"
          ariaLabel="Unit"
        />
        <input
          type="text"
          value={row.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Ingredient"
          aria-label="Ingredient name"
          className="flex-1 min-w-0 bg-transparent border-0 text-sm py-1.5 px-1 outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove ingredient"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
      <input
        type="text"
        value={row.notes ?? ''}
        onChange={(e) => onUpdate({ notes: e.target.value || null })}
        placeholder="Notes (e.g. finely chopped)"
        aria-label="Notes"
        className="mt-1 w-full bg-transparent border-0 text-xs text-stone-600 dark:text-stone-400 py-1 pl-9 pr-2 outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
      />
    </div>
  );
}

function CompactInput({
  value,
  onChange,
  placeholder,
  width,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  width: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ width }}
      className="bg-transparent border-0 text-sm py-1.5 px-1 outline-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
    />
  );
}
