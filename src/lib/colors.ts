// Spec §5.3: "Hero area: solid colour derived from title"
//
// A small, deterministic hash → hue mapping. Saturation and lightness are
// fixed so every hero has the same visual weight; only hue varies.
// Two different titles can collide, which is fine — this is decorative.

function hashString(input: string): number {
  // djb2-style. Plenty good for hue derivation.
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Hue 0–359 from a recipe title. */
export function hueForTitle(title: string): number {
  return hashString(title.toLowerCase().trim()) % 360;
}

/** Pre-baked CSS color strings keyed off the title. Used in style={{...}}. */
export function heroColors(title: string, isDark: boolean): {
  background: string;
  foreground: string;
} {
  const h = hueForTitle(title);
  // Soft, muted palette so it sits comfortably with the sage/stone theme.
  return isDark
    ? {
        background: `oklch(0.30 0.05 ${h})`,
        foreground: `oklch(0.92 0.02 ${h})`,
      }
    : {
        background: `oklch(0.88 0.06 ${h})`,
        foreground: `oklch(0.28 0.05 ${h})`,
      };
}
