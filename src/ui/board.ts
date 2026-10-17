/** Shared Tailwind class strings for the canvas-board pages (bloodline,
 *  calendar, plotboard, wellspring, timelinecanvas, conlang — the old
 *  bloodline.css `.bl-*` chrome, now utilities). */
export const BOARD_HEADER = "flex items-center gap-3.5 py-3 px-[18px] bg-night border-b border-line";
export const BOARD_NAME_INPUT = "bg-transparent border-0 text-gold font-display text-xl font-semibold w-[220px] outline-none";
export const BOARD_ACTIONS = "flex gap-2 ml-auto";
export const BOARD_ACTION_BTN = "bg-ink text-parchment-dim border border-line rounded-sm px-2.5 py-1.5 transition-colors hover:text-parchment hover:border-gold-dim disabled:opacity-40 disabled:cursor-default aria-pressed:border-gold aria-pressed:text-gold";
export const BOARD_PANEL = "bg-night border-l border-line p-4 overflow-y-auto overflow-x-hidden";
export const BOARD_PANEL_HEAD = "flex items-center justify-between gap-2.5 mb-3.5";
export const BOARD_PANEL_HEAD_H2 = "text-[1.125rem] font-display";
export const BOARD_PANEL_HINT = "text-slate";
export const BOARD_NOTEPAD = "absolute top-3.5 right-[320px] w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]";
export const BOARD_NOTEPAD_HEAD = "flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase";
export const BOARD_NOTEPAD_TXT = "w-full border-0 border-t border-line bg-transparent text-parchment px-2.5 py-2 resize-y min-h-[90px]";