/** Swatch list that never hides the current value: presets first, current
 *  appended when it is not one of them. Used by every color swatch row. */
export function withCurrentColor(presets: readonly string[], current: string | undefined): string[] {
  if (!current || presets.includes(current)) return [...presets];
  return [...presets, current];
}