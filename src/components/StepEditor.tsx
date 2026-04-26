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
import type { StepDraft } from '../types';
import { cx } from '../lib/utils';

interface Props {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}

/**
 * Step editor (spec §5.4.2). Step numbers update automatically on reorder.
 *
 * See IngredientEditor for the rationale behind the stable-uid pattern —
 * deriving keys from row content unmounts inputs on every keystroke.
 */
export default function StepEditor({ steps, onChange }: Props) {
  const nextUid = useRef(0);
  const uids = useRef<number[]>([]);

  while (uids.current.length < steps.length) {
    uids.current.push(nextUid.current++);
  }
  if (uids.current.length > steps.length) {
    uids.current.length = steps.length;
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
    const reordered = arrayMove(steps, oldIndex, newIndex);
    onChange(reordered.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const updateRow = (index: number, instruction: string) => {
    const next = [...steps];
    next[index] = { ...next[index]!, instruction };
    onChange(next);
  };

  const removeRow = (index: number) => {
    uids.current.splice(index, 1);
    onChange(
      steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepNumber: i + 1 })),
    );
  };

  const addRow = () => {
    uids.current.push(nextUid.current++);
    onChange([
      ...steps,
      { stepNumber: steps.length + 1, instruction: '' },
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
            {steps.map((row, index) => (
              <SortableStepRow
                key={uids.current[index]}
                uid={uids.current[index]!}
                row={row}
                number={index + 1}
                onUpdate={(v) => updateRow(index, v)}
                onRemove={() => removeRow(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <p className="text-sm text-stone-500 dark:text-stone-400 py-3 text-center">
          No steps yet.
        </p>
      )}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 px-3 py-2 rounded-full text-sm font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
      >
        + Add step
      </button>
    </div>
  );
}

function SortableStepRow({
  uid,
  row,
  number,
  onUpdate,
  onRemove,
}: {
  uid: number;
  row: StepDraft;
  number: number;
  onUpdate: (instruction: string) => void;
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
        'flex items-start gap-2 rounded-xl',
        'border border-stone-200 dark:border-stone-800',
        'bg-stone-50 dark:bg-stone-900',
        'p-2',
        isDragging && 'opacity-60 shadow-lg z-10',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 dark:text-stone-500 cursor-grab active:cursor-grabbing touch-none mt-0.5"
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
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full bg-sage-700 dark:bg-sage-500 text-stone-50 dark:text-stone-950 text-xs font-semibold flex items-center justify-center mt-0.5"
        aria-label={`Step ${number}`}
      >
        {number}
      </span>
      <textarea
        value={row.instruction}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={`Instructions for step ${number}…`}
        aria-label={`Step ${number} instructions`}
        rows={2}
        className="flex-1 min-w-0 bg-transparent border-0 text-sm py-1 px-1 outline-none resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove step"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 mt-0.5"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}
