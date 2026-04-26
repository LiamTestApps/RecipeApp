import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getRecipeWithRelations,
  createRecipe,
  updateRecipe,
} from '../db';
import type { RecipeDraft } from '../types';
import EditHeader from '../components/EditHeader';
import StarRating from '../components/StarRating';
import TagInput from '../components/TagInput';
import IngredientEditor from '../components/IngredientEditor';
import StepEditor from '../components/StepEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import SmartExtractModal from '../components/SmartExtractModal';
import FromUrlModal from '../components/FromUrlModal';
import type { ExtractedRecipe } from '../lib/gemini';
import { cx } from '../lib/utils';

interface Props {
  mode: 'create' | 'edit';
}

const EMPTY_DRAFT: RecipeDraft = {
  title: '',
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  sourceUrl: null,
  notes: null,
  rating: null,
  ingredients: [],
  steps: [],
  tagNames: [],
};

/**
 * Add/edit screen (spec §5.4). One component, two modes — saves a brand-new
 * row in `create` mode, replaces the existing one in `edit` mode.
 *
 * Dirty tracking lets us prompt before discarding unsaved changes when the
 * user hits Cancel. We compute it from a structural comparison rather than
 * a separate "isDirty" flag — that way every keystroke doesn't have to
 * remember to flip the flag.
 */
export default function RecipeEditPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = id ? Number.parseInt(id, 10) : NaN;

  // Existing recipe (edit mode only)
  const existing = useLiveQuery(
    () =>
      mode === 'edit' && Number.isFinite(recipeId)
        ? getRecipeWithRelations(recipeId)
        : Promise.resolve(undefined),
    [mode, recipeId],
  );

  const [draft, setDraft] = useState<RecipeDraft>(EMPTY_DRAFT);
  /** The draft we'd compare against for "is dirty?" checks. */
  const [pristine, setPristine] = useState<RecipeDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(mode === 'create');

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [smartExtractOpen, setSmartExtractOpen] = useState(false);
  const [fromUrlOpen, setFromUrlOpen] = useState(false);

  // Hydrate the draft from an existing recipe in edit mode.
  useEffect(() => {
    if (mode !== 'edit') return;
    if (!existing) return;
    if (hydrated) return;
    const initial: RecipeDraft = {
      id: existing.id,
      title: existing.title,
      prepTimeMinutes: existing.prepTimeMinutes,
      cookTimeMinutes: existing.cookTimeMinutes,
      sourceUrl: existing.sourceUrl,
      notes: existing.notes,
      rating: existing.rating,
      ingredients: existing.ingredients.map((i) => ({
        quantity: i.quantity,
        unit: i.unit,
        name: i.name,
        notes: i.notes,
        sortOrder: i.sortOrder,
      })),
      steps: existing.steps.map((s) => ({
        stepNumber: s.stepNumber,
        instruction: s.instruction,
      })),
      tagNames: existing.tags.map((t) => t.name),
    };
    setDraft(initial);
    setPristine(initial);
    setHydrated(true);
  }, [mode, existing, hydrated]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(pristine),
    [draft, pristine],
  );

  const titleValid = draft.title.trim().length > 0;

  const handleSave = async () => {
    if (!titleValid || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (mode === 'create') {
        const newId = await createRecipe(draft);
        navigate(`/recipe/${newId}`, { replace: true });
      } else {
        await updateRecipe(recipeId, draft);
        navigate(`/recipe/${recipeId}`, { replace: true });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save.');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      goBack();
    }
  };

  const goBack = () => {
    if (mode === 'edit') {
      navigate(`/recipe/${recipeId}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (mode === 'edit' && !Number.isFinite(recipeId)) {
    return <CenteredMessage>Invalid recipe URL.</CenteredMessage>;
  }
  if (mode === 'edit' && existing === undefined) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (mode === 'edit' && existing === null) {
    return <CenteredMessage>Recipe not found.</CenteredMessage>;
  }

  return (
    <>
      <EditHeader
        title={mode === 'create' ? 'New Recipe' : 'Edit Recipe'}
        onCancel={handleCancel}
        onSave={handleSave}
        saveDisabled={!titleValid || isSaving}
        saveLabel={isSaving ? 'Saving…' : 'Save'}
      />

      <div className="mx-auto max-w-md px-4 py-4 space-y-6">
        {/* Title */}
        <Field label="Title" required>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Sunday roast chicken"
            aria-required="true"
            aria-invalid={!titleValid}
            className={inputCx}
          />
        </Field>

        {/* Times — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prep time">
            <MinutesInput
              value={draft.prepTimeMinutes}
              onChange={(v) => setDraft({ ...draft, prepTimeMinutes: v })}
              placeholder="—"
            />
          </Field>
          <Field label="Cook time">
            <MinutesInput
              value={draft.cookTimeMinutes}
              onChange={(v) => setDraft({ ...draft, cookTimeMinutes: v })}
              placeholder="—"
            />
          </Field>
        </div>

        {/* Source URL */}
        <Field label="Source URL">
          <input
            type="url"
            inputMode="url"
            value={draft.sourceUrl ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, sourceUrl: e.target.value || null })
            }
            placeholder="https://…"
            className={inputCx}
          />
        </Field>

        {/* Rating */}
        <Field label="Rating">
          <div className="py-1">
            <StarRating
              value={draft.rating}
              onChange={(v) => setDraft({ ...draft, rating: v })}
              size="lg"
            />
          </div>
        </Field>

        {/* Tags */}
        <Field label="Tags">
          <TagInput
            values={draft.tagNames}
            onChange={(v) => setDraft({ ...draft, tagNames: v })}
          />
        </Field>

        {/* Ingredients */}
        <Field label="Ingredients">
          <IngredientEditor
            ingredients={draft.ingredients}
            onChange={(v) => setDraft({ ...draft, ingredients: v })}
            onSmartExtractClick={() => setSmartExtractOpen(true)}
            onFromUrlClick={() => setFromUrlOpen(true)}
          />
        </Field>

        {/* Steps */}
        <Field label="Steps">
          <StepEditor
            steps={draft.steps}
            onChange={(v) => setDraft({ ...draft, steps: v })}
          />
        </Field>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            value={draft.notes ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, notes: e.target.value || null })
            }
            rows={3}
            placeholder="Storage tips, substitutions, who liked it…"
            className={cx(inputCx, 'resize-y min-h-[5rem]')}
          />
        </Field>

        {saveError && (
          <p
            role="alert"
            className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3"
          >
            {saveError}
          </p>
        )}

        {/* Bottom save (mirrors the header for thumb reach on long forms) */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!titleValid || isSaving}
          className={cx(
            'w-full px-4 py-3 rounded-full font-medium',
            !titleValid || isSaving
              ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed'
              : 'bg-sage-700 text-stone-50 dark:bg-sage-500 dark:text-stone-950',
          )}
        >
          {isSaving ? 'Saving…' : mode === 'create' ? 'Save recipe' : 'Save changes'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        message="You have unsaved changes. They'll be lost if you go back now."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          goBack();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <SmartExtractModal
        open={smartExtractOpen}
        onClose={() => setSmartExtractOpen(false)}
        onApply={(extracted: ExtractedRecipe) => {
          // Apply directly to the draft. The user chose this UX over a
          // preview screen — they'll edit anything they don't like.
          setDraft({
            ...draft,
            // Only overwrite the title if the field is currently blank;
            // a user mid-typing shouldn't lose their title.
            title: draft.title.trim() ? draft.title : extracted.title,
            prepTimeMinutes: extracted.prepTimeMinutes ?? draft.prepTimeMinutes,
            cookTimeMinutes: extracted.cookTimeMinutes ?? draft.cookTimeMinutes,
            ingredients: extracted.ingredients.map((ing, idx) => ({
              quantity: ing.quantity,
              unit: ing.unit,
              name: ing.name,
              notes: ing.notes,
              sortOrder: idx,
            })),
            steps: extracted.steps.map((instruction, idx) => ({
              stepNumber: idx + 1,
              instruction,
            })),
          });
          setSmartExtractOpen(false);
        }}
      />

      <FromUrlModal
        open={fromUrlOpen}
        onClose={() => setFromUrlOpen(false)}
        onApply={(extracted: ExtractedRecipe, sourceUrl: string) => {
          // Same apply policy as Smart Extract, plus auto-populate the
          // Source URL field so the user can always click back to the
          // original recipe.
          setDraft({
            ...draft,
            title: draft.title.trim() ? draft.title : extracted.title,
            prepTimeMinutes: extracted.prepTimeMinutes ?? draft.prepTimeMinutes,
            cookTimeMinutes: extracted.cookTimeMinutes ?? draft.cookTimeMinutes,
            sourceUrl: draft.sourceUrl ?? sourceUrl,
            ingredients: extracted.ingredients.map((ing, idx) => ({
              quantity: ing.quantity,
              unit: ing.unit,
              name: ing.name,
              notes: ing.notes,
              sortOrder: idx,
            })),
            steps: extracted.steps.map((instruction, idx) => ({
              stepNumber: idx + 1,
              instruction,
            })),
          });
          setFromUrlOpen(false);
        }}
      />
    </>
  );
}

// ─── Small primitives ────────────────────────────────────────────────────────

const inputCx =
  'w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-sage-500 dark:focus:border-sage-400 placeholder:text-stone-400 dark:placeholder:text-stone-500';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400 mb-1.5">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Numeric input that stores `null` for empty / non-numeric values. Min 0, no
 * upper bound — the user might genuinely want a 12-hour roast.
 */
function MinutesInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const n = Number.parseInt(raw, 10);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        placeholder={placeholder}
        className={cx(inputCx, 'pr-12')}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 dark:text-stone-500 pointer-events-none">
        min
      </span>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-16 text-center text-sm text-stone-500 dark:text-stone-400">
      {children}
    </div>
  );
}
