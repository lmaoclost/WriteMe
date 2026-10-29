/** Shared Tailwind class strings for world/page cards (the old
 *  projects.css `.project-card` pattern + empty states). Card craft comes
 *  from the Lamplight contract: hover glow via .lamp-card, 40px delete hit
 *  area, tabular-nums stamps. */
export const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4";
export const WORLD_CARD = "lamp-card relative flex flex-col min-h-[120px] overflow-hidden rounded-lg border border-line bg-night transition-[border-color] duration-[180ms] hover:border-gold-dim";
export const CARD_LINK = "grid gap-1.5 p-4 text-inherit no-underline";
export const CARD_NAME = "text-[1.25rem]";
export const CARD_DESC = "text-slate text-[0.8125rem] m-0";
export const CARD_UPDATED = "text-[var(--text-faint)] text-xs m-0 [font-variant-numeric:tabular-nums]";
export const CARD_COVER = "h-[120px] w-full object-cover";
export const DELETE_CHIP = "absolute top-2 right-2 flex size-[26px] items-center justify-center rounded-sm border border-line bg-ink text-xs text-slate transition-colors hover:border-danger hover:text-danger after:absolute after:inset-[-7px] after:content-['']";
export const EMPTY_STATE = "grid justify-items-center gap-3.5 rounded-lg border border-dashed border-line p-10 text-center text-parchment-dim";
